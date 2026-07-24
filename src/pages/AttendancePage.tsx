import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import api from '../api/axios';
import { Clock, Calendar, Check, X, Trash2, Eye, ShieldAlert, AlertCircle, CheckCircle, Info, Download, Lightbulb, Upload, ChevronLeft, ChevronRight, Camera, Image, FileText, Zap, RefreshCw, Moon, MapPin, CheckSquare, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { useUIStore } from '../store/uiStore';
import type { Period, DateRange } from '../components/ui/PeriodFilter';

const resolveAttachmentUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  let cleanPath = path.replace(/^\/+/, '');
  if (cleanPath.startsWith('deposits/')) {
    cleanPath = 'uploads/' + cleanPath;
  }
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const baseClean = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${baseClean}/${cleanPath}`;
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
  const [modalTab, setModalTab] = useState<'checkin' | 'fingerprint' | 'night_duty' | 'activities'>('checkin');

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

  // Scheduler / Diary creation states
  const [diaryNoteText, setDiaryNoteText] = useState('');
  const [newActivityType, setNewActivityType] = useState<'task' | 'meeting' | 'call' | 'note'>('task');
  const [newActivitySubject, setNewActivitySubject] = useState('');
  const [newActivityBody, setNewActivityBody] = useState('');
  const [newActivityContactId, setNewActivityContactId] = useState<string>('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [contactsList, setContactsList] = useState<any[]>([]);

  const [calendarActivities, setCalendarActivities] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [meetingToComplete, setMeetingToComplete] = useState<any | null>(null);
  const [proofCommentText, setProofCommentText] = useState('');
  const [proofImageFile, setProofImageFile] = useState<File | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  const [completingMeeting, setCompletingMeeting] = useState(false);

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
      const res = await fetchAPI('get_consultants&all=1');
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

  const fetchContactsList = async () => {
    try {
      const res = await api.get('/contacts?limit=1000');
      const conData = res.data?.data;
      const list = Array.isArray(conData?.items) ? conData.items : (Array.isArray(conData) ? conData : (Array.isArray(res.data) ? res.data : []));
      setContactsList(list);
    } catch (e) {
      console.error('Error fetching contacts:', e);
    }
  };

  useEffect(() => {
    fetchConsultantsList();
    fetchContactsList();
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
          reason: suppReason,
          is_supplementary: true
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

  const getLateMinutes = (checkInTimeStr: string, workStartTimeStr: string = '08:00') => {
    if (!checkInTimeStr) return 0;
    const [ciH, ciM] = checkInTimeStr.split(':').map(Number);
    const [wsH, wsM] = workStartTimeStr.split(':').map(Number);
    const checkInMins = (ciH || 0) * 60 + (ciM || 0);
    const workStartMins = (wsH || 0) * 60 + (wsM || 0);
    return Math.max(0, checkInMins - workStartMins);
  };

  const workDaysCount = useMemo(() => {
    const validCheckIns = checkIns.filter(c => c.status === 'approved');
    const uniqueDates = new Set(validCheckIns.map(c => c.check_in_date));
    return uniqueDates.size || approvedCount;
  }, [checkIns, approvedCount]);

  const lateCheckIns = useMemo(() => {
    return checkIns.filter(c => {
      const isLate = c.check_in_time > (c.work_start_time || '08:00');
      return isLate || c.status === 'pending_approval';
    });
  }, [checkIns]);

  const lateDays = lateCheckIns.length;
  const onTimeDays = Math.max(0, approvedCount - checkIns.filter(c => c.status === 'approved' && c.check_in_time > (c.work_start_time || '08:00')).length);

  const totalLateMinutes = useMemo(() => {
    return checkIns.reduce((acc, c) => {
      return acc + getLateMinutes(c.check_in_time, c.work_start_time || '08:00');
    }, 0);
  }, [checkIns]);

  const shiftList = viewMode === 'calendar' ? calendarShifts : (registrations || []);
  const nightShiftsCount = useMemo(() => shiftList.filter((s: any) => s.shift_type === 'night').length, [shiftList]);
  const weekendShiftsCount = useMemo(() => shiftList.filter((s: any) => s.shift_type === 'weekend').length, [shiftList]);
  const holidayShiftsCount = useMemo(() => shiftList.filter((s: any) => s.shift_type === 'holiday').length, [shiftList]);
  const totalShiftsCount = shiftList.length;

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
            const isHoliday = cell.dateStr && (
              dayShifts.some(s => s.shift_type === 'holiday') ||
              (sysSettings?.holidays && Array.isArray(sysSettings.holidays) && sysSettings.holidays.some((h: any) => h.date === cell.dateStr))
            );

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
                    ? (isHoliday
                      ? 'rgba(239, 68, 68, 0.07)'
                      : 'var(--color-surface)')
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
                            const isSupplementary = !c.selfie_url;

                            let bg = isApproved ? (checkInLate ? 'rgba(0, 122, 255, 0.06)' : 'rgba(16, 185, 129, 0.08)') : isPending ? 'rgba(245, 158, 11, 0.06)' : 'rgba(239, 68, 68, 0.06)';
                            let border = isApproved ? (checkInLate ? 'rgba(0, 122, 255, 0.15)' : 'rgba(16, 185, 129, 0.15)') : isPending ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                            let txtColor = isApproved ? (checkInLate ? '#007aff' : '#10b981') : isPending ? '#d97706' : '#ef4444';
                            let tagLabel = isSales ? (isSupplementary ? t('Cập nhật công') : t('Check-in')) : c.user_name;

                            if (isSupplementary) {
                              bg = 'rgba(139, 92, 246, 0.08)';
                              border = 'rgba(139, 92, 246, 0.25)';
                              txtColor = '#8B5CF6';
                            }

                            return (
                              <div
                                key={c.id}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  padding: '5px 8px',
                                  borderRadius: '8px',
                                  border: `1px solid ${border}`,
                                  backgroundColor: bg,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                }}
                                className="single-checkin-tag"
                              >
                                <div style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  color: txtColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '4px'
                                }}>
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                                    {tagLabel}
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
                                      style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                      title={t('Trực đêm: ') + nights.map(n => n.user_name).join(', ')}
                                    >
                                      <Moon size={11} /> {nights.length}
                                    </span>
                                  )}
                                  {weekends.length > 0 && (
                                    <span 
                                      style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                      title={t('Cuối tuần: ') + weekends.map(w => w.user_name).join(', ')}
                                    >
                                      <Calendar size={11} /> {weekends.length}
                                    </span>
                                  )}
                                  {holidays.length > 0 && (
                                    <span 
                                      style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                      title={t('Ngày lễ: ') + holidays.map(h => h.user_name).join(', ')}
                                    >
                                      <Zap size={11} /> {holidays.length}
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
                              let ShiftIcon = Moon;
                              if (s.shift_type === 'weekend') {
                                label = t('Cuối tuần');
                                bg = 'rgba(239, 68, 68, 0.05)';
                                border = 'rgba(239, 68, 68, 0.2)';
                                text = '#ef4444';
                                ShiftIcon = Calendar;
                              } else if (s.shift_type === 'holiday') {
                                label = s.holiday_name ? `${t('Lễ')} (${s.holiday_name})` : t('Ngày lễ');
                                bg = 'rgba(239, 68, 68, 0.05)';
                                border = 'rgba(239, 68, 68, 0.2)';
                                text = '#ef4444';
                                ShiftIcon = Zap;
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
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '85px' }}>
                                    <ShiftIcon size={10} />
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
        {/* Card 1: Approved / Valid */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          padding: '0.875rem 1.125rem',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div className="decor-svg" style={{ color: '#10b981' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M30 50 L 45 65 L 75 35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t('ĐÃ DUYỆT / HỢP LỆ')}
            </span>
            <div className="stat-icon" style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', flexShrink: 0 }}>
              <CheckCircle size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.625rem', fontWeight: 800, color: '#10b981', marginTop: '4px', lineHeight: 1.1 }}>
            {approvedCount}
          </div>
          <div style={{
            marginTop: '6px',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '4px 12px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
              <span>{t('Đang chờ duyệt')}: <strong style={{ color: '#f59e0b' }}>{pendingCount}</strong> {t('bản ghi')}</span>
            </span>
          </div>
        </div>

        {/* Card 2: Rejected */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          padding: '0.875rem 1.125rem',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div className="decor-svg" style={{ color: '#ef4444' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M35 35 L 65 65 M 65 35 L 35 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t('BỊ TỪ CHỐI')}
            </span>
            <div className="stat-icon" style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', flexShrink: 0 }}>
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.625rem', fontWeight: 800, color: '#ef4444', marginTop: '4px', lineHeight: 1.1 }}>
            {rejectedCount}
          </div>
          <div style={{
            marginTop: '6px',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '4px 12px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
              <span>{t('Không được phê duyệt')}</span>
            </span>
          </div>
        </div>

        {/* Card 3: Work Days (Month N) */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          padding: '0.875rem 1.125rem',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div className="decor-svg" style={{ color: '#3b82f6' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <rect x="25" y="25" width="50" height="50" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M25 40 H 75 M 40 20 V 30 M 60 20 V 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t(`NGÀY CÔNG THÁNG ${currentMonth}`)}
            </span>
            <div className="stat-icon" style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', flexShrink: 0 }}>
              <Calendar size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px', lineHeight: 1.1 }}>
            {workDaysCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('ngày')}</span>
          </div>
          <div style={{
            marginTop: '6px',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '4px 12px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', flexShrink: 0 }} />
              <span>{t('Đúng giờ')}: <strong style={{ color: '#10b981' }}>{onTimeDays}</strong> {t('ngày')}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
              <span>{t('Đi trễ')}: <strong style={{ color: '#f59e0b' }}>{lateDays}</strong> {t('ngày')} ({totalLateMinutes} {t('phút')})</span>
            </span>
          </div>
        </div>

        {/* Card 4: Total Shifts */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          padding: '0.875rem 1.125rem',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div className="decor-svg" style={{ color: '#8b5cf6' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <path d="M50 20 C 35 20, 25 32, 25 47 C 25 62, 35 74, 50 74 C 65 74, 75 62, 75 47 C 60 47, 50 37, 50 20 Z" stroke="currentColor" strokeWidth="2" opacity="0.3" fill="none" />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {t('TỔNG CA TRỰC')}
            </span>
            <div className="stat-icon" style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', flexShrink: 0 }}>
              <Moon size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px', lineHeight: 1.1 }}>
            {totalShiftsCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('ca')}</span>
          </div>
          <div style={{
            marginTop: '6px',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '4px 12px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#d97706', display: 'inline-block', flexShrink: 0 }} />
              <span>{t('Trực đêm')}: <strong style={{ color: '#d97706' }}>{nightShiftsCount}</strong> {t('ca')}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'inline-block', flexShrink: 0 }} />
              <span>{t('Cuối tuần')}: <strong style={{ color: 'var(--color-primary)' }}>{weekendShiftsCount}</strong> {t('ca')}</span>
            </span>
            {holidayShiftsCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                <span>{t('Lễ tết')}: <strong style={{ color: '#ef4444' }}>{holidayShiftsCount}</strong> {t('ca')}</span>
              </span>
            )}
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

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: isLate ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                <Clock size={14} />
                                <span>{t('Vào:')} {row.check_in_time ? row.check_in_time.substring(0, 5) : '--:--'}</span>
                                {isLate && (
                                  <span style={{ fontSize: '0.65rem', fontWeight: 500, backgroundColor: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                    {t('Trễ')} {row.late_minutes ? `${row.late_minutes}m` : ''}
                                  </span>
                                )}
                                {row.latitude && row.longitude && (
                                  <a
                                    href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={row.location_address || t('Xem bản đồ vị trí Check-in')}
                                    style={{ color: 'var(--color-primary)', display: 'inline-flex', marginLeft: '4px' }}
                                  >
                                    <MapPin size={12} />
                                  </a>
                                )}
                              </div>
                              {row.check_out_time && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: row.early_minutes > 0 ? '#f59e0b' : 'var(--color-text-muted)' }}>
                                  <span>{t('Ra:')} {row.check_out_time.substring(11, 16)}</span>
                                  {row.early_minutes > 0 && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 500, backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706', padding: '1px 5px', borderRadius: '4px' }}>
                                      {t('Về sớm')} {row.early_minutes}m
                                    </span>
                                  )}
                                  {row.checkout_latitude && row.checkout_longitude && (
                                    <a
                                      href={`https://www.google.com/maps?q=${row.checkout_latitude},${row.checkout_longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={row.checkout_location_address || t('Xem bản đồ vị trí Check-out')}
                                      style={{ color: 'var(--color-primary)', display: 'inline-flex', marginLeft: '4px' }}
                                    >
                                      <MapPin size={12} />
                                    </a>
                                  )}
                                </div>
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
                            {row.reason || row.admin_note ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {row.reason && (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                    <ShieldAlert size={14} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                                    <span>{row.reason}</span>
                                  </div>
                                )}
                                {row.admin_note && (
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', width: 'fit-content' }}>
                                    <span style={{ fontWeight: 600, color: '#3b82f6', flexShrink: 0 }}>{t('Ghi chú duyệt')}:</span>
                                    <span>{row.admin_note}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>{t('Không có')}</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            {(() => {
                              const isSupplementary = !row.selfie_url;

                              let bg = row.status === 'approved' ? (isLate ? 'rgba(0, 122, 255, 0.08)' : 'var(--color-success-light)') : row.status === 'pending_approval' ? 'var(--color-warning-light)' : 'var(--color-danger-light)';
                              let color = row.status === 'approved' ? (isLate ? '#007aff' : 'var(--color-success)') : row.status === 'pending_approval' ? 'var(--color-warning)' : 'var(--color-danger)';
                              let label = row.status === 'approved' ? (isLate ? t('Đã duyệt') : t('Đúng giờ')) : row.status === 'pending_approval' ? t('Chờ duyệt đi trễ') : t('Bị từ chối');

                              if (isSupplementary) {
                                bg = 'rgba(139, 92, 246, 0.1)';
                                color = '#8B5CF6';
                                if (row.status === 'pending_approval') {
                                  label = t('Đang chờ cập nhật công');
                                } else if (row.status === 'approved') {
                                  label = t('Cập nhật công');
                                } else {
                                  label = t('Từ chối cập nhật công');
                                }
                              }

                              return (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  backgroundColor: bg,
                                  color: color,
                                  border: isSupplementary ? '1px solid rgba(139, 92, 246, 0.2)' : 'none'
                                }}>
                                  {row.status === 'approved' && <CheckCircle size={12} />}
                                  {row.status === 'pending_approval' && <AlertCircle size={12} />}
                                  {row.status === 'rejected' && <X size={12} />}
                                  {label}
                                </span>
                              );
                            })()}
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
                              {['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '') && (
                                <button
                                  onClick={() => openDeleteConfirm(row.id)}
                                  className="btn outline sm danger icon-only"
                                  title={t('Xóa bản ghi')}
                                  style={{ width: 28, height: 28, padding: 0, borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                >
                                  <Trash2 size={14} />
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
            {(previewCheckIn.latitude || previewCheckIn.checkout_latitude) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', fontSize: '0.78rem', color: 'var(--color-text)' }}>
                {previewCheckIn.latitude && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <MapPin size={14} style={{ color: '#4b5563', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ lineHeight: 1.4, textAlign: 'left' }}>
                      <a
                        href={`https://www.google.com/maps?q=${previewCheckIn.latitude},${previewCheckIn.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        {t('Xem vị trí')}
                      </a>
                      {previewCheckIn.location_address && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                          {previewCheckIn.location_address}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {previewCheckIn.checkout_latitude && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '4px' }}>
                    <MapPin size={14} style={{ color: '#4b5563', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ lineHeight: 1.4, textAlign: 'left' }}>
                      <a
                        href={`https://www.google.com/maps?q=${previewCheckIn.checkout_latitude},${previewCheckIn.checkout_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        {t('Xem vị trí')}
                      </a>
                      {previewCheckIn.checkout_location_address && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                          {previewCheckIn.checkout_location_address}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Google Map Position embed */}
                {previewCheckIn.latitude && (
                  <iframe
                    src={`https://maps.google.com/maps?q=${previewCheckIn.latitude},${previewCheckIn.longitude}&z=16&output=embed`}
                    width="100%"
                    height="180"
                    style={{ border: 0, borderRadius: '8px', marginTop: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                    allowFullScreen={false}
                    loading="lazy"
                  />
                )}
              </div>
            )}
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

              {(() => {
                const detailDayShifts = calendarShifts.filter(s => s.shift_date === selectedDateForDetail);
                const hasHoliday = detailDayShifts.some(s => s.shift_type === 'holiday');
                const dayOfWeek = selectedDateForDetail ? new Date(selectedDateForDetail).getDay() : 1;
                const isWeekendDetail = dayOfWeek === 0 || dayOfWeek === 6;
                const activeShiftType = hasHoliday ? 'holiday' : isWeekendDetail ? 'weekend' : 'night';

                return (
                  <button
                    type="button"
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
                    {activeShiftType === 'holiday' ? (
                      <Zap size={isMobile ? 13 : 16} />
                    ) : activeShiftType === 'weekend' ? (
                      <Calendar size={isMobile ? 13 : 16} />
                    ) : (
                      <Moon size={isMobile ? 13 : 16} />
                    )}
                    {activeShiftType === 'holiday'
                      ? t('Trực lễ')
                      : activeShiftType === 'weekend'
                      ? t('Trực cuối tuần')
                      : t('Trực đêm')}
                    <span style={{
                      fontSize: '0.625rem',
                      padding: isMobile ? '1px 4px' : '2px 6px',
                      borderRadius: '10px',
                      background: modalTab === 'night_duty' ? 'var(--color-primary-light)' : 'var(--color-bg)',
                      color: modalTab === 'night_duty' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: 600
                    }}>
                      {detailDayShifts.length}
                    </span>
                  </button>
                );
              })()}


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
                              {(() => {
                                const isSupplementary = !row.selfie_url;

                                let bg = row.status === 'approved' ? (isLate ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-success-light)') : row.status === 'pending_approval' ? 'var(--color-warning-light)' : 'var(--color-danger-light)';
                                let color = row.status === 'approved' ? (isLate ? '#10b981' : 'var(--color-success)') : row.status === 'pending_approval' ? 'var(--color-warning)' : 'var(--color-danger)';
                                let label = row.status === 'approved' ? (isLate ? t('Hợp lệ') : t('Đúng giờ')) : row.status === 'pending_approval' ? t('Chờ duyệt đi trễ') : t('Bị từ chối');

                                if (isSupplementary) {
                                  bg = 'rgba(139, 92, 246, 0.1)';
                                  color = '#8B5CF6';
                                  if (row.status === 'pending_approval') {
                                    label = t('Đang chờ cập nhật công');
                                  } else if (row.status === 'approved') {
                                    label = t('Cập nhật công');
                                  } else {
                                    label = t('Từ chối cập nhật công');
                                  }
                                }

                                return (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: '20px',
                                    backgroundColor: bg,
                                    color: color,
                                    border: isSupplementary ? '1px solid rgba(139, 92, 246, 0.2)' : (row.status === 'approved' && isLate ? '1px solid rgba(16, 185, 129, 0.2)' : 'none'),
                                  }}>
                                    {label}
                                  </span>
                                );
                              })()}
                            </div>

                            {(() => {
                              const isSupplementary = !row.selfie_url;
                              return (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                                      <span>{isSupplementary ? t('Thời gian đề xuất:') : t('Thời gian:')} <strong>{row.check_in_time}</strong></span>
                                      {isLate && !isSupplementary && <span style={{ color: 'var(--color-danger)', marginLeft: '6px', fontWeight: 600 }}>({t('Trễ')})</span>}
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
                                    <div style={{
                                      fontSize: '0.7rem',
                                      background: isSupplementary ? 'rgba(139, 92, 246, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                                      border: isSupplementary ? '1px solid rgba(139, 92, 246, 0.15)' : '1px solid rgba(245, 158, 11, 0.1)',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      color: 'var(--color-text-muted)',
                                      marginBottom: '4px'
                                    }}>
                                      <strong>{isSupplementary ? t('Lý do cập nhật:') : t('Lý do trễ:')}</strong> {row.reason}
                                    </div>
                                  )}

                                  {row.latitude && row.longitude && (
                                    <div style={{
                                      fontSize: '0.72rem',
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '4px',
                                      color: 'var(--color-text-muted)',
                                      marginTop: '6px',
                                      textAlign: 'left'
                                    }}>
                                      <MapPin size={12} style={{ color: '#4b5563', marginTop: '2px', flexShrink: 0 }} />
                                      <div style={{ lineHeight: 1.3 }}>
                                        <a
                                          href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ color: 'var(--color-primary)', fontWeight: 650, textDecoration: 'underline' }}
                                        >
                                          {t('Xem vị trí')}
                                        </a>
                                        {row.location_address && ` - ${row.location_address}`}
                                      </div>
                                    </div>
                                  )}

                                  {row.checkout_latitude && row.checkout_longitude && (
                                    <div style={{
                                      fontSize: '0.72rem',
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '4px',
                                      color: 'var(--color-text-muted)',
                                      marginTop: '6px',
                                      textAlign: 'left'
                                    }}>
                                      <MapPin size={12} style={{ color: '#4b5563', marginTop: '2px', flexShrink: 0 }} />
                                      <div style={{ lineHeight: 1.3 }}>
                                        <a
                                          href={`https://www.google.com/maps?q=${row.checkout_latitude},${row.checkout_longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ color: 'var(--color-primary)', fontWeight: 650, textDecoration: 'underline' }}
                                        >
                                          {t('Xem vị trí')}
                                        </a>
                                        {row.checkout_location_address && ` - ${row.checkout_location_address}`}
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {row.status === 'pending_approval' && canApprove && (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button
                                  disabled={actionSubmittingId === row.id}
                                  onClick={() => {
                                    showConfirm({
                                      title: t('Phê duyệt đi trễ'),
                                      message: t('Bạn có chắc chắn muốn phê duyệt yêu cầu đi trễ này?'),
                                      optionalPromptInput: true,
                                      promptPlaceholder: t('Nhập lưu ý/nội dung phê duyệt (tùy chọn)...'),
                                      confirmText: t('Phê duyệt'),
                                      cancelText: t('Hủy'),
                                      onConfirm: (reason) => {
                                        return handleUpdateStatus(row.id, 'approved', reason ? reason.trim() : undefined);
                                      }
                                    });
                                  }}
                                  className="btn success sm"
                                  style={{ padding: '3px 10px', fontSize: '0.7rem', height: 'auto', borderRadius: '6px', opacity: actionSubmittingId === row.id ? 0.6 : 1 }}
                                >
                                  {actionSubmittingId === row.id ? <RefreshCw size={12} className="spin" /> : <Check size={12} />} {t('Phê duyệt')}
                                </button>
                                <button
                                  disabled={actionSubmittingId === row.id}
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
                                          return handleUpdateStatus(row.id, 'rejected', reason.trim());
                                        } else {
                                          toast.error(t('Lý do từ chối là bắt buộc'));
                                        }
                                      }
                                    });
                                  }}
                                  className="btn danger sm"
                                  style={{ padding: '3px 10px', fontSize: '0.7rem', height: 'auto', borderRadius: '6px', opacity: actionSubmittingId === row.id ? 0.6 : 1 }}
                                >
                                  {actionSubmittingId === row.id ? <RefreshCw size={12} className="spin" /> : <X size={12} />} {t('Từ chối')}
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
                  {isSales ? (() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const detailCheckIns = calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail);
                    const pendingCheckIn = detailCheckIns.find(c => c.status === 'pending_approval');
                    const approvedCheckIn = detailCheckIns.find(c => c.status === 'approved');

                    if (pendingCheckIn) {
                      const isSupp = !pendingCheckIn.selfie_url;
                      return (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          background: isSupp ? 'rgba(139, 92, 246, 0.04)' : 'rgba(245, 158, 11, 0.04)',
                          border: isSupp ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                          padding: '2.5rem 1.5rem',
                          borderRadius: '12px',
                          textAlign: 'center',
                          height: '100%',
                          minHeight: '220px'
                        }}>
                          {isSupp ? <Clock size={38} color="#8B5CF6" /> : <AlertCircle size={38} color="var(--color-warning)" />}
                          <h4 style={{ fontWeight: 700, fontSize: '1rem', color: isSupp ? '#8B5CF6' : 'var(--color-warning)', margin: 0 }}>
                            {isSupp ? t('Đang chờ cập nhật công') : t('Đang chờ duyệt đi trễ')}
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '280px', lineHeight: 1.45 }}>
                            {isSupp
                              ? `${t('Yêu cầu cập nhật công cho ngày ')}${selectedDateForDetail}${t(' của bạn đang chờ quản trị viên phê duyệt.')}`
                              : `${t('Báo cáo đi trễ ngày ')}${selectedDateForDetail}${t(' của bạn đang chờ quản trị viên phê duyệt.')}`
                            }
                          </p>
                        </div>
                      );
                    }

                    if (approvedCheckIn) {
                      return (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          background: 'rgba(16, 185, 129, 0.04)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          padding: '2.5rem 1.5rem',
                          borderRadius: '12px',
                          textAlign: 'center',
                          height: '100%',
                          minHeight: '220px'
                        }}>
                          <CheckCircle size={38} color="var(--color-success)" />
                          <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
                            {selectedDateForDetail && selectedDateForDetail < todayStr ? t('Cập nhật công của bạn đã được duyệt') : t('Đã Chấm Công')}
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '280px', lineHeight: 1.45 }}>
                            {t('Dữ liệu chấm công cho ngày ')}{selectedDateForDetail}{t(' đã được hệ thống và quản trị viên phê duyệt thành công.')}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0 }}>
                          📝 {t('Yêu Cầu Cập Nhật Công Bổ Sung')}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                          {t('Gửi yêu cầu cập nhật công bổ sung cho ngày ')}{selectedDateForDetail}{t('. Quản trị viên sẽ phê duyệt yêu cầu này.')}
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
                          {suppSubmitting ? t('Đang gửi yêu cầu...') : t('Gửi yêu cầu cập nhật công')}
                        </button>
                      </div>
                    );
                  })() : (
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
                /* Sub-tab 3: Duty Shift Log */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                    {(() => {
                      const dayShifts = calendarShifts.filter(s => s.shift_date === selectedDateForDetail);
                      const hasHoliday = dayShifts.some(s => s.shift_type === 'holiday');
                      const dayOfWeek = selectedDateForDetail ? new Date(selectedDateForDetail).getDay() : 1;
                      const isWeekendDetail = dayOfWeek === 0 || dayOfWeek === 6;
                      const activeShiftType = hasHoliday ? 'holiday' : isWeekendDetail ? 'weekend' : 'night';

                      if (dayShifts.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
                            {activeShiftType === 'holiday' ? (
                              <Zap size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                            ) : activeShiftType === 'weekend' ? (
                              <Calendar size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                            ) : (
                              <Moon size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                            )}
                            <p style={{ fontSize: '0.8125rem' }}>
                              {activeShiftType === 'holiday'
                                ? t('Không có nhân sự nào được phân công trực lễ trong ngày này.')
                                : activeShiftType === 'weekend'
                                ? t('Không có nhân sự nào được phân công trực cuối tuần trong ngày này.')
                                : t('Không có nhân sự nào được phân công trực đêm trong ngày này.')}
                            </p>
                          </div>
                        );
                      }
                      return dayShifts.map((row, rIdx) => (
                        <div key={row.id || `${row.shift_type}-${rIdx}`} style={{
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
                              {row.shift_type === 'holiday'
                                ? `🎉 ${t('Trực lễ')} ${row.holiday_name ? `(${row.holiday_name})` : ''}`
                                : row.shift_type === 'weekend'
                                ? `📅 ${t('Trực cuối tuần')}`
                                : `🌙 ${t('Trực đêm')} (${sysSettings?.night_shift_start_time || '18:00'} - ${sysSettings?.night_shift_end_time || '06:00'})`}
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

      <CustomerProfileDrawer
        isOpen={!!selectedContact}
        onClose={() => {
          setSelectedContact(null);
          fetchCalendarCheckIns();
        }}
        contact={selectedContact}
        onUpdate={() => {
          fetchCalendarCheckIns();
        }}
      />

      {/* Meeting Proof Modal */}
      {meetingToComplete && createPortal(
        <>
          <style>{`
            .proof-modal-overlay {
              z-index: 1000000000 !important;
            }
          `}</style>
          <div 
            className="proof-modal-overlay" 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 2100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setMeetingToComplete(null)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ 
              width: '100%', 
              maxWidth: 500, 
              padding: '1.5rem', 
              borderRadius: '16px', 
              overflow: 'hidden', 
              background: 'var(--color-surface)', 
              border: '1px solid var(--color-border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Camera style={{ color: '#10b981' }} size={20} />
                {t('Cung cấp ảnh minh chứng')}
              </h3>
              <button 
                type="button"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }} 
                onClick={() => setMeetingToComplete(null)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5, margin: 0 }}>
              {t('Gặp gỡ này chưa có ảnh đính kèm trong phần bình luận. Bạn phải tải lên ảnh minh chứng (chụp ảnh cùng khách hàng, sa bàn, v.v.) để hoàn thành cuộc gặp.')}
            </p>

            <div style={{ marginBottom: '1.25rem', marginTop: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>{t('Ảnh minh chứng *')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {proofImagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <img src={proofImagePreview} alt="Proof preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      type="button"
                      onClick={() => {
                        setProofImageFile(null);
                        setProofImagePreview(null);
                      }}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '120px', border: '2px dashed var(--color-border)', borderRadius: '10px', cursor: 'pointer', background: 'var(--color-bg)', transition: 'border-color 0.2s' }}>
                    <Camera size={28} style={{ color: 'var(--color-text-muted)', marginBottom: '6px' }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Tải ảnh lên (JPEG, PNG, WebP)')}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error(t('Dung lượng tệp đính kèm không được vượt quá 5MB'));
                          return;
                        }
                        const previewUrl = URL.createObjectURL(file);
                        setProofImageFile(file);
                        setProofImagePreview(previewUrl);
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>{t('Nội dung bình luận')}</label>
              <textarea
                style={{ width: '100%', minHeight: '80px', fontSize: '0.875rem', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', outline: 'none', resize: 'none', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                value={proofCommentText}
                onChange={(e) => setProofCommentText(e.target.value)}
                placeholder={t('Nhập ghi chú hoặc mô tả về buổi gặp gỡ...')}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn outline" onClick={() => setMeetingToComplete(null)} disabled={completingMeeting}>{t('Hủy')}</button>
              <button 
                type="button"
                className="btn success" 
                disabled={!proofImageFile || completingMeeting} 
                onClick={async () => {
                  if (!proofImageFile || !meetingToComplete) return;
                  setCompletingMeeting(true);
                  try {
                    let fileToUpload = proofImageFile;
                    try {
                      const { compressToWebP } = await import('../utils/imageCompress');
                      fileToUpload = await compressToWebP(proofImageFile);
                    } catch (err) {}
                    
                    const fd = new FormData();
                    fd.append('file', fileToUpload);
                    const uploadRes = await api.post('/upload', fd, {
                      headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    const uploadedUrl = uploadRes.data.data?.url ?? uploadRes.data.data?.path ?? uploadRes.data.url ?? '';
                    if (!uploadedUrl) throw new Error('Không thể tải ảnh lên');

                    // Post comment
                    const payload = {
                      content: proofCommentText,
                      attachments: JSON.stringify([uploadedUrl]),
                      parent_id: null
                    };
                    await api.post(`/activities/${meetingToComplete.id}/comments`, payload);
                    if (meetingToComplete.contact_id) {
                      try {
                        const notePayload = {
                          entity_type: 'contact',
                          entity_id: meetingToComplete.contact_id,
                          body: `[Ảnh minh chứng Gặp gỡ] ${proofCommentText.trim()}`,
                          attachments: JSON.stringify([uploadedUrl])
                        };
                        await api.post('/notes', notePayload);
                      } catch (noteErr) {
                        console.error('Lỗi khi sao chép ghi chú khách hàng:', noteErr);
                      }
                    }

                    // Complete activity
                    await api.put(`/activities/${meetingToComplete.id}`, { status: 'done', progress: 100 });

                    toast.success(t('Đã tải ảnh minh chứng và hoàn thành gặp gỡ'));
                    
                    setCalendarActivities(prev => prev.map(x => x.id === meetingToComplete.id ? { ...x, status: 'done' } : x));
                    
                    fetchCalendarCheckIns();
                    setMeetingToComplete(null);
                  } catch (e: any) {
                    toast.error(e.response?.data?.message || t('Có lỗi xảy ra khi lưu minh chứng'));
                  } finally {
                    setCompletingMeeting(false);
                  }
                }}
              >
                {completingMeeting ? t('Đang lưu...') : t('Xác nhận')}
              </button>
            </div>
          </div>
        </div>
        </>,
        document.body
      )}

    </div>
  );
};

export const AttendancePage = withRouterFreezer(AttendancePageInner, '/attendance');
export default AttendancePage;
