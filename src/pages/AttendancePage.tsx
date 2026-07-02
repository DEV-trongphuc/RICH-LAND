import React, { useEffect, useState } from 'react';
import { withRouterFreezer } from '../components/RouterFreezer';
import { fetchAPI } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import { Avatar } from '../components/ui/Avatar';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Clock, Calendar, Check, X, Trash2, Eye, ShieldAlert, AlertCircle, CheckCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';

const AttendancePageInner = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);

  // View mode switcher: list or calendar
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState<number>(7); // July 2026 default
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [calendarCheckIns, setCalendarCheckIns] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Filter states
  const [period, setPeriod] = useState<Period>('7d');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    // Default range (last 7 days from July 1, 2026 for demo integrity)
    return { from: '2026-06-25', to: '2026-07-01' };
  });
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Preview Image Modal state
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Confirm delete states
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action submitting state
  const [actionSubmittingId, setActionSubmittingId] = useState<number | null>(null);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                if (currentMonth === 1) {
                  setCurrentMonth(12);
                  setCurrentYear(prev => prev - 1);
                } else {
                  setCurrentMonth(prev => prev - 1);
                }
              }}
              className="btn outline sm"
              style={{ padding: '4px 10px', height: 'auto', borderRadius: '6px' }}
            >
              &lt;
            </button>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, minWidth: '130px', textAlign: 'center', color: 'var(--color-text)' }}>
              {t('Tháng {month} / {year}').replace('{month}', String(currentMonth)).replace('{year}', String(currentYear))}
            </h3>
            <button
              onClick={() => {
                if (currentMonth === 12) {
                  setCurrentMonth(1);
                  setCurrentYear(prev => prev + 1);
                } else {
                  setCurrentMonth(prev => prev + 1);
                }
              }}
              className="btn outline sm"
              style={{ padding: '4px 10px', height: 'auto', borderRadius: '6px' }}
            >
              &gt;
            </button>
          </div>
          
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {filterUser === 'all' 
              ? t('Nhấp chọn một ngày để xem danh sách chi tiết ngày đó.') 
              : t('Hiển thị lịch chấm công của TVV được chọn.')}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
          backgroundColor: 'var(--color-border-light)',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--color-border-light)'
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
                    setPeriod('custom');
                    setCustomRange({ from: cell.dateStr, to: cell.dateStr });
                    setViewMode('list');
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {approved.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--color-success)', fontWeight: 600, backgroundColor: 'var(--color-success-light)', padding: '2px 6px', borderRadius: '4px' }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
                            {approved.length} {t('Đúng giờ')}
                          </div>
                        )}
                        {pending.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--color-warning)', fontWeight: 600, backgroundColor: 'var(--color-warning-light)', padding: '2px 6px', borderRadius: '4px' }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--color-warning)' }} />
                            {pending.length} {t('Chờ duyệt')}
                          </div>
                        )}
                        {rejected.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--color-danger)', fontWeight: 600, backgroundColor: 'var(--color-danger-light)', padding: '2px 6px', borderRadius: '4px' }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
                            {rejected.length} {t('Từ chối')}
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
                              <span>{c.user_name}</span>
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
                  ) : cell.dateStr && !isWeekend ? (
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', fontStyle: 'italic', padding: '4px', textAlign: 'center' }}>
                      {t('Vắng / Chưa check-in')}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">
            {t('Quản lý Chấm công')}
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            {t('Kiểm duyệt ảnh selfie chấm công hàng ngày và phê duyệt đi trễ của tư vấn viên.')}
          </p>
        </div>

        {/* View Mode Switcher */}
        <div style={{ display: 'flex', backgroundColor: 'var(--color-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
              color: viewMode === 'list' ? 'var(--color-text)' : 'var(--color-text-muted)',
              boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Clock size={14} />
            {t('Danh sách')}
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: viewMode === 'calendar' ? 'var(--color-surface)' : 'transparent',
              color: viewMode === 'calendar' ? 'var(--color-text)' : 'var(--color-text-muted)',
              boxShadow: viewMode === 'calendar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <Calendar size={14} />
            {t('Lịch biểu')}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <div className="stat-card hover-lift" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('TỔNG BẢN GHI')}</div>
          <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>{totalCount}</div>
        </div>
        <div className="stat-card hover-lift" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>{t('ĐÃ DUYỆT / HỢP LỆ')}</div>
          <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '4px' }}>{approvedCount}</div>
        </div>
        <div className="stat-card hover-lift" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--color-warning)', fontWeight: 600 }}>{t('ĐANG CHỜ DUYỆT')}</div>
          <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: '4px' }}>{pendingCount}</div>
        </div>
        <div className="stat-card hover-lift" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
          <div className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>{t('BỊ TỪ CHỐI')}</div>
          <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: '4px' }}>{rejectedCount}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Period Filter (List View only) */}
          {viewMode === 'list' && (
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
          )}

          {/* User Select */}
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
              setFilterUser('all');
              setFilterStatus('all');
            }}
            className="btn outline sm"
            style={{ marginTop: '20px', height: '38px', borderRadius: '8px' }}
          >
            {t('Đặt lại bộ lọc')}
          </button>
        </div>
      </div>

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
