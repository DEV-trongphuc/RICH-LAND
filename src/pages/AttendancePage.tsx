import React, { useEffect, useState } from 'react';
import { withRouterFreezer } from '../components/RouterFreezer';
import { fetchAPI } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Clock, Calendar, Check, X, Trash2, Eye, ShieldAlert, AlertCircle, CheckCircle, Info, Download, Lightbulb, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';

export const AttendancePageInner = ({ embedMode = false }: { embedMode?: boolean }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isSales = user?.role === 'sale';
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Selected date for detail modal
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<string | null>(null);

  // Supplementary check-in states
  const [suppTime, setSuppTime] = useState('08:00');
  const [suppReason, setSuppReason] = useState('');
  const [suppSubmitting, setSuppSubmitting] = useState(false);

  // Preview Image Modal state
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
      const query = `check-ins&year=${currentYear}&month=${currentMonth}&status=${filterStatus}&user_id=${filterUser}`;
      const res = await fetchAPI(query);
      if (res.success) {
        setCalendarCheckIns(res.data || []);
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
  }, [period, customRange, filterUser, filterStatus]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      fetchCalendarCheckIns();
    }
  }, [viewMode, currentMonth, currentYear, filterUser, filterStatus]);

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
              borderRadius: '20px',
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
              className="btn outline sm"
              style={{
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
                borderRadius: '20px',
                height: '38px',
                padding: '0 16px',
                fontWeight: 600,
                fontSize: '0.8125rem'
              }}
            >
              {t('Hôm nay')}
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            {/* User Select */}
            {!isSales && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Tư vấn viên')}</label>
                <CustomSelect
                  options={[
                    { value: 'all', label: t('Tất cả nhân viên') },
                    ...consultants.map(c => ({ value: String(c.id), label: c.name }))
                  ]}
                  value={filterUser}
                  onChange={(val) => setFilterUser(String(val))}
                  width="100%"
                />
              </div>
            )}

            {/* Status Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Trạng thái duyệt')}</label>
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
              className="btn outline sm"
              style={{ height: '38px', borderRadius: '8px' }}
            >
              {t('Đặt lại bộ lọc')}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', width: '100%', borderRadius: '12px' }} className="custom-scrollbar">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            backgroundColor: 'var(--color-border-light)',
            overflow: 'hidden',
            border: '1px solid var(--color-border-light)',
            minWidth: isMobile ? '700px' : 'auto'
          }}>
          {weekDays.map((day, idx) => (
            <div key={idx} style={{
              backgroundColor: 'var(--color-bg)',
              padding: '10px 4px',
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: idx === 6 ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRight: idx < 6 ? '1px solid var(--color-border-light)' : 'none'
            }}>
              {day}
            </div>
          ))}

          {cells.map((cell, idx) => {
            const dayCheckIns = getCellData(cell.dateStr);
            const isWeekend = (idx % 7 === 5 || idx % 7 === 6);

            const approved = dayCheckIns ? dayCheckIns.filter(c => c.status === 'approved') : [];
            const pending = dayCheckIns ? dayCheckIns.filter(c => c.status === 'pending_approval') : [];
            const rejected = dayCheckIns ? dayCheckIns.filter(c => c.status === 'rejected') : [];
            const isToday = cell.dateStr && new Date().toDateString() === new Date(cell.dateStr).toDateString();

            return (
              <div
                key={idx}
                onClick={() => {
                  if (cell.dateStr) {
                    setSelectedDateForDetail(cell.dateStr);
                  }
                }}
                style={{
                  backgroundColor: isToday
                    ? 'rgba(189, 29, 45, 0.08)'
                    : cell.isCurrentMonth
                      ? isWeekend
                        ? 'var(--color-calendar-weekend)'
                        : 'var(--color-surface)'
                      : 'var(--color-bg)',
                  minHeight: '110px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: cell.dateStr ? 'pointer' : 'default',
                  opacity: cell.isCurrentMonth ? 1 : 0.4,
                  borderRight: '1px solid var(--color-border)',
                  borderBottom: '1px solid var(--color-border)',
                  position: 'relative'
                }}
                className={cell.dateStr ? 'calendar-day-cell' : ''}
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
                    color: isToday ? 'white' : isWeekend ? 'var(--color-danger)' : 'var(--color-text-light)'
                  }}>{cell.day}</span>
                  {isToday && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-primary)' }}>{t('Hôm nay')}</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  {calendarLoading && cell.isCurrentMonth ? (
                    <div style={{ height: '4px', backgroundColor: 'var(--color-border)', borderRadius: '2px', animation: 'pulse 1.5s infinite' }} />
                  ) : cell.dateStr && dayCheckIns && dayCheckIns.length > 0 ? (
                    filterUser === 'all' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                        {dayCheckIns.slice(0, 4).map((c: any) => {
                          const statusColor = 
                            c.status === 'approved' ? 'var(--color-success)' :
                            c.status === 'pending_approval' ? 'var(--color-warning)' :
                            'var(--color-danger)';
                          return (
                            <div key={c.id} style={{ position: 'relative', display: 'inline-block' }} title={`${c.user_name} (${c.check_in_time})`}>
                              <Avatar src={c.user_avatar} name={c.user_name} size={24} />
                              <span style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: statusColor,
                                border: '1px solid var(--color-surface)',
                                boxShadow: '0 0 2px rgba(0,0,0,0.2)'
                              }} />
                            </div>
                          );
                        })}
                        {dayCheckIns.length > 4 && (
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'var(--color-text-muted)'
                          }}>
                            +{dayCheckIns.length - 4}
                          </div>
                        )}
                      </div>
                    ) : (
                      dayCheckIns.map(c => {
                        const checkInLate = c.check_in_time > (c.work_start_time || '08:00');
                        return (
                          <div
                            key={c.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              padding: '4px',
                              borderRadius: '6px',
                              border: '1px solid',
                              backgroundColor: 
                                c.status === 'approved' ? 'rgba(16, 185, 129, 0.05)' :
                                c.status === 'pending_approval' ? 'rgba(245, 158, 11, 0.05)' :
                                'rgba(239, 68, 68, 0.05)',
                              borderColor: 
                                c.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' :
                                c.status === 'pending_approval' ? 'rgba(245, 158, 11, 0.2)' :
                                'rgba(239, 68, 68, 0.2)',
                            }}
                          >
                            <div style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: 
                                c.status === 'approved' ? 'var(--color-success)' :
                                c.status === 'pending_approval' ? 'var(--color-warning)' :
                                'var(--color-danger)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <span>{isSales ? t('Check-in:') : c.user_name}</span>
                              <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{c.check_in_time.substring(0, 5)}</span>
                            </div>
                            {c.selfie_url && (
                              <img
                                src={c.selfie_url}
                                style={{ width: '100%', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border-light)' }}
                                alt="Selfie"
                              />
                            )}
                          </div>
                        );
                      })
                    )
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
        `}</style>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      {!embedMode && (
        <div className="page-header flex-col-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">
              {t('Quản lý Chấm công')}
            </h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              {t('Kiểm duyệt ảnh selfie chấm công hàng ngày và phê duyệt đi trễ của tư vấn viên.')}
            </p>
          </div>

          {/* View Mode Switcher */}
          <div style={{ display: 'flex', backgroundColor: 'var(--color-border-light)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '8px 20px',
                fontSize: '0.85rem',
                fontWeight: 700,
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-light)',
                boxShadow: viewMode === 'list' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s'
              }}
              className={viewMode === 'list' ? '' : 'hover-lift'}
            >
              <Clock size={14} />
              {t('Danh sách')}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                padding: '8px 20px',
                fontSize: '0.85rem',
                fontWeight: 700,
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: viewMode === 'calendar' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'calendar' ? 'var(--color-primary)' : 'var(--color-text-light)',
                boxShadow: viewMode === 'calendar' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s'
              }}
              className={viewMode === 'calendar' ? '' : 'hover-lift'}
            >
              <Calendar size={14} />
              {t('Lịch biểu')}
            </button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        {/* Card 1: Total */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: '1.5rem',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
              {t('TỔNG BẢN GHI')}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-light)', color: 'var(--color-text-muted)' }}>
              <Calendar size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '8px', lineHeight: 1.2 }}>
            {totalCount}
          </div>
          <div style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            borderTop: '1px solid var(--color-border-light)',
            paddingTop: '10px'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-text-muted)' }} />
              {t('Ghi nhận từ các TVV')}
            </span>
          </div>
        </div>

        {/* Card 2: Approved */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: '1.5rem',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.05em' }}>
              {t('ĐÃ DUYỆT / HỢP LỆ')}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <CheckCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginTop: '8px', lineHeight: 1.2 }}>
            {approvedCount}
          </div>
          <div style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            borderTop: '1px solid var(--color-border-light)',
            paddingTop: '10px'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              {t('Đúng giờ & đi trễ hợp lệ')}
            </span>
          </div>
        </div>

        {/* Card 3: Pending */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: '1.5rem',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.05em' }}>
              {t('ĐANG CHỜ DUYỆT')}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b', marginTop: '8px', lineHeight: 1.2 }}>
            {pendingCount}
          </div>
          <div style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            borderTop: '1px solid var(--color-border-light)',
            paddingTop: '10px'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              {t('Yêu cầu phê duyệt đi trễ')}
            </span>
          </div>
        </div>

        {/* Card 4: Rejected */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: '1.5rem',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, letterSpacing: '0.05em' }}>
              {t('BỊ TỪ CHỐI')}
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <AlertCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444', marginTop: '8px', lineHeight: 1.2 }}>
            {rejectedCount}
          </div>
          <div style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            borderTop: '1px solid var(--color-border-light)',
            paddingTop: '10px'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
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
            {!isSales && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Tư vấn viên')}</label>
                <CustomSelect
                  options={[
                    { value: 'all', label: t('Tất cả nhân viên') },
                    ...consultants.map(c => ({ value: String(c.id), label: c.name }))
                  ]}
                  value={filterUser}
                  onChange={(val) => setFilterUser(String(val))}
                  width="100%"
                />
              </div>
            )}

            {/* Status Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Trạng thái duyệt')}</label>
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
              className="btn outline sm"
              style={{ marginTop: '20px', height: '38px', borderRadius: '8px' }}
            >
              {t('Đặt lại bộ lọc')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {viewMode === 'list' ? (
        <div className="card" style={{ padding: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', background: 'var(--color-bg)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TƯ VẤN VIÊN')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('GIỜ QUY ĐỊNH')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('GIỜ CHECK-IN')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>{t('ẢNH SELFIE')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('LÝ DO TRỄ / GHI CHÚ')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TRẠNG THÁI')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'right' }}>{t('HÀNH ĐỘNG')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(4)].map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                ) : checkIns.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      <Info size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                      {t('Không tìm thấy dữ liệu chấm công cho ngày đã chọn.')}
                    </td>
                  </tr>
                ) : (
                  checkIns.map((row) => {
                    const isLate = row.check_in_time > (row.work_start_time || '08:00');
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem' }} className="group table-row-hover">
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={row.user_avatar} name={row.user_name} size={32} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.user_name}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{row.user_email}</span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px', color: 'var(--color-text-light)' }}>
                          {row.work_start_time || '08:00'}
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
                            <div
                              style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
                              onClick={() => setPreviewImage(row.selfie_url)}
                            >
                              <img
                                src={row.selfie_url}
                                style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-border)' }}
                                alt="Selfie"
                              />
                              <div className="overlay" style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.4)', borderRadius: '6px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s'
                              }}>
                                <Eye size={12} style={{ color: '#fff' }} />
                              </div>
                              <style>{`
                                div:hover .overlay { opacity: 1 !important; }
                              `}</style>
                            </div>
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
                              row.status === 'approved' ? 'var(--color-success-light)' :
                              row.status === 'pending_approval' ? 'var(--color-warning-light)' :
                              'var(--color-danger-light)',
                            color:
                              row.status === 'approved' ? 'var(--color-success)' :
                              row.status === 'pending_approval' ? 'var(--color-warning)' :
                              'var(--color-danger)',
                          }}>
                            {row.status === 'approved' && <CheckCircle size={12} />}
                            {row.status === 'pending_approval' && <AlertCircle size={12} />}
                            {row.status === 'rejected' && <X size={12} />}
                            {row.status === 'approved' ? t('Đã duyệt / Đúng giờ') :
                             row.status === 'pending_approval' ? t('Chờ duyệt đi trễ') :
                             t('Bị từ chối')}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {row.status === 'pending_approval' && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(row.id, 'approved')}
                                  disabled={actionSubmittingId === row.id}
                                  className="btn success sm icon-only"
                                  title={t('Duyệt nhận lead')}
                                  style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(row.id, 'rejected')}
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
        </div>
      ) : (
        renderCalendarView()
      )}

      {/* Selfie Lightbox Preview Modal */}
      {previewImage && (
        <CustomModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          title={t('Ảnh selfie check-in')}
          width="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <img
              src={previewImage}
              style={{ width: '100%', maxHeight: '450px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#000' }}
              alt="Selfie phóng to"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="btn secondary sm"
              style={{ alignSelf: 'flex-end' }}
            >
              {t('Đóng')}
            </button>
          </div>
        </CustomModal>
      )}

      {/* Day Detail Modal with side-by-side file preview */}
      {selectedDateForDetail && (
        <CustomModal
          isOpen={!!selectedDateForDetail}
          onClose={() => setSelectedDateForDetail(null)}
          title={`${t('Chi tiết chấm công ngày')} ${selectedDateForDetail}`}
          width="960px"
        >
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: '1.5rem', minHeight: '400px' }}>
            {/* Left Panel: Real-time Check-ins list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: isMobile ? 'none' : '1px solid var(--color-border-light)', paddingRight: isMobile ? 0 : '1.5rem', borderBottom: isMobile ? '1px dashed var(--color-border-light)' : 'none', paddingBottom: isMobile ? '1.5rem' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0 }}>
                  📋 {t('Nhật ký Check-in')}
                </h4>
                <span className="badge info">
                  {calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).length} {t('bản ghi')}
                </span>
              </div>

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
                            <Avatar src={row.user_avatar} name={row.user_name} size={28} />
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
                              row.status === 'approved' ? 'var(--color-success-light)' :
                              row.status === 'pending_approval' ? 'var(--color-warning-light)' :
                              'var(--color-danger-light)',
                            color:
                              row.status === 'approved' ? 'var(--color-success)' :
                              row.status === 'pending_approval' ? 'var(--color-warning)' :
                              'var(--color-danger)',
                          }}>
                            {row.status === 'approved' ? t('Đúng giờ') :
                             row.status === 'pending_approval' ? t('Chờ duyệt') :
                             t('Bị từ chối')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                            <span>{t('Thời gian:')} <strong>{row.check_in_time}</strong></span>
                            {isLate && <span style={{ color: 'var(--color-danger)', marginLeft: '6px', fontWeight: 600 }}>({t('Trễ')})</span>}
                          </div>
                          {row.selfie_url && (
                            <img
                              src={row.selfie_url}
                              onClick={() => setPreviewImage(row.selfie_url)}
                              style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-border)', cursor: 'pointer' }}
                              alt="Selfie"
                            />
                          )}
                        </div>

                        {row.reason && (
                          <div style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)', padding: '6px 8px', borderRadius: '6px', color: 'var(--color-text-muted)' }}>
                            <strong>{t('Lý do trễ:')}</strong> {row.reason}
                          </div>
                        )}

                        {row.status === 'pending_approval' && (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button
                              onClick={() => handleUpdateStatus(row.id, 'approved')}
                              className="btn success sm"
                              style={{ padding: '3px 10px', fontSize: '0.7rem', height: 'auto', borderRadius: '6px' }}
                            >
                              <Check size={12} /> {t('Phê duyệt')}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(row.id, 'rejected')}
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

            {/* Right Panel: Official Attendance File Preview & Export / Supplementary Check-in Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {isSales ? (
                // Sales supplementary request form
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
    </div>
  );
};

export const AttendancePage = withRouterFreezer(AttendancePageInner, '/attendance');
export default AttendancePage;
