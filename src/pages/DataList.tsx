import { useState, useEffect } from 'react';
import { Database, Search, Filter, ChevronLeft, ChevronRight, Download, RefreshCw, User, Phone, Mail, Clock, Tag, ExternalLink, AlertTriangle, Plus, CheckCircle2, XCircle, ShieldAlert, Calendar, LayoutList } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Avatar } from '../components/ui/Avatar';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

type Lead = {
  id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  assigned_to_name: string;
  assigned_to_avatar?: string;
  round_name: string;
  created_at: string;
  type?: string;
  note?: string;
  report_status?: string;
  resolved_by?: string | null;
  resolved_at?: string | null;
};

import { fetchAPI } from '../utils/api';

const maskPhone = (phone: string) => {
  if (!phone || phone === '-') return phone;
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length < 8) return phone;
  const start = clean.slice(0, clean.length - 6);
  const end = clean.slice(-3);
  return `${start}***${end}`;
};

const maskEmail = (email: string) => {
  if (!email || email === '-') return email;
  const parts = email.split('@');
  if (parts.length < 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 3) {
    return `${name.slice(0, 1)}***@${domain}`;
  }
  return `${name.slice(0, 3)}***${name.slice(-1)}@${domain}`;
};

const parseNote = (noteText: string) => {
  if (!noteText) return { cleanNote: '', errorNotes: [], blacklistNotes: [] };
  const normalized = noteText.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');
  const cleanLines: string[] = [];
  const errorNotes: string[] = [];
  const blacklistNotes: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (/^(?:Nhập dữ liệu cũ|Nhap du lieu cu)\s*(?:\(Silent\))?$/i.test(trimmed)) {
      return;
    }
    if (trimmed.startsWith('[LỖI -') || trimmed.startsWith('[LỖI ')) {
      errorNotes.push(trimmed);
    } else if (
      trimmed.startsWith('[Bị chặn bởi') ||
      trimmed.startsWith('[Chặn bởi') ||
      trimmed.toLowerCase().startsWith('[bị chặn bởi') ||
      trimmed.toLowerCase().startsWith('[chặn bởi')
    ) {
      blacklistNotes.push(trimmed);
    } else {
      cleanLines.push(line);
    }
  });

  return {
    cleanNote: cleanLines.join('\n').trim(),
    errorNotes,
    blacklistNotes
  };
};

const parseErrorNote = (err: string) => {
  const parts = err.split(' | ');
  let admin = '';
  let time = '';

  parts.forEach(part => {
    const trimmed = part.trim();
    if (trimmed.startsWith('Admin duyệt:') || trimmed.startsWith('Admin từ chối:')) {
      admin = trimmed.substring(trimmed.indexOf(':') + 1).trim();
    } else if (trimmed.startsWith('Thời gian:')) {
      time = trimmed.substring(trimmed.indexOf(':') + 1).trim();
    }
  });

  const cleanText = parts.filter(part => {
    const trimmed = part.trim();
    return !trimmed.startsWith('Admin duyệt:') && !trimmed.startsWith('Admin từ chối:') && !trimmed.startsWith('Thời gian:');
  }).join(' | ');

  return { cleanText, admin, time };
};

const parseBlacklistNote = (note: string) => {
  let admin = 'Hệ thống';
  let time = 'Hệ thống';
  let reason = '';

  const adminMatch = note.match(/bởi\s+Admin\s+([^\s]+(?:\s+[^\s]+)*?)(?:\s+lúc|$)/i);
  if (adminMatch && adminMatch[1]) {
    admin = adminMatch[1].trim();
  }

  const timeMatch = note.match(/lúc\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
  if (timeMatch && timeMatch[1]) {
    time = timeMatch[1].trim();
  }

  const reasonMatch = note.match(/Lý\s+do:\s*(.*?)\]?$/i);
  if (reasonMatch && reasonMatch[1]) {
    reason = reasonMatch[1].trim();
  }

  return { admin, time, reason };
};

export const DataList = () => {
  const { user } = useAuth();
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

  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const dateFilter = searchParams.get('date') || 'this_month';
  const consultantFilter = searchParams.get('consultant') || 'all';
  const roundFilter = searchParams.get('round') || 'all';
  const currentPage = Number(searchParams.get('page') || '1');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [rounds, setRounds] = useState<{ id: number; round_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const json = await fetchAPI(`get_logs&page=${currentPage}&pageSize=${ITEMS_PER_PAGE}&date=${encodeURIComponent(dateFilter)}&status=${encodeURIComponent(statusFilter)}&consultant=${encodeURIComponent(consultantFilter)}&round=${encodeURIComponent(roundFilter)}&search=${encodeURIComponent(searchTerm)}`);
      if (json.success) {
        // Map the backend structure to the frontend structure
        const mappedLeads = json.data.map((item: any) => ({
          id: item.id,
          name: item.lead_name || 'Khách hàng ẩn danh',
          phone: item.phone || '-',
          email: item.email || '-',
          source: item.source || '-',
          type: item.type || '-',
          note: item.note || '',
          status: item.status,
          assigned_to_name: item.assigned_to_name || '-',
          assigned_to_avatar: item.assigned_to_avatar,
          round_name: item.round_name || '-',
          created_at: item.created_at,
          report_status: item.report_status
        }));
        setLeads(mappedLeads);
        // BUG-04 fix: track truncation
        setTotalCount(json.total_count ?? mappedLeads.length);
      }
    } catch (e: any) {
      toast.error('Lỗi tải dữ liệu: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, [searchParams]);

  useEffect(() => {
    fetchConsultants();
    fetchRounds();
  }, []);

  useEffect(() => {
    const handleLeadAdded = () => {
      fetchLeads();
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, [searchParams]);

  const updateParams = (key: string, value: string) => {
    setSearchParams(prev => {
      if (value === 'all' || value === '') prev.delete(key);
      else prev.set(key, value);
      if (key !== 'page') prev.delete('page');
      return prev;
    }, { replace: true });
  };

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [consultants, setConsultants] = useState<{ id: number; name: string; status: string; avatar?: string }[]>([]);
  const [reassignConsId, setReassignConsId] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);
  const [confirmReassignOpen, setConfirmReassignOpen] = useState<boolean>(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState<boolean>(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const [compensateBlock, setCompensateBlock] = useState<boolean>(false);
  const [isBlocking, setIsBlocking] = useState<boolean>(false);

  // Calendar View Mode States
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(searchParams.get('view') === 'calendar' ? 'calendar' : 'list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<any>(null);
  const [dayDetailsLoading, setDayDetailsLoading] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'sales' | 'tickets' | 'blacklist'>('sales');

  const fetchCalendarStats = async () => {
    setCalendarLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const json = await fetchAPI(`get_calendar_stats&year=${year}&month=${month}&consultant=${encodeURIComponent(consultantFilter)}`);
      if (json.success) {
        setCalendarData(json.data || {});
      }
    } catch (e: any) {
      toast.error('Lỗi tải dữ liệu lịch: ' + e.message);
    }
    setCalendarLoading(false);
  };

  const handleDateClick = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setDayDetailsLoading(true);
    setDayDetails(null);
    try {
      const json = await fetchAPI(`get_calendar_day_details&date=${dateStr}&consultant=${encodeURIComponent(consultantFilter)}`);
      if (json.success) {
        setDayDetails(json.data);
      }
    } catch (e: any) {
      toast.error('Lỗi tải chi tiết ngày: ' + e.message);
    }
    setDayDetailsLoading(false);
  };

  useEffect(() => {
    if (viewMode === 'calendar') {
      fetchCalendarStats();
    }
  }, [viewMode, currentDate, consultantFilter]);

  useEffect(() => {
    if (selectedDate) {
      handleDateClick(selectedDate);
    }
  }, [consultantFilter]);

  const fetchConsultants = async () => {
    try {
      const json = await fetchAPI('get_consultants');
      if (json.success) {
        setConsultants(json.data.filter((c: any) => c.status === 'active'));
      }
    } catch (e: any) {
      console.error(e.message);
    }
  };

  const fetchRounds = async () => {
    try {
      const json = await fetchAPI('get_rounds');
      if (json.success) {
        setRounds(json.data);
      }
    } catch (e: any) {
      console.error(e.message);
    }
  };

  const handleReassign = async (compensate: boolean = false) => {
    if (!selectedLead || !reassignConsId) return;
    setIsReassigning(true);
    try {
      const res = await fetchAPI('reassign_lead', {
        method: 'POST',
        body: JSON.stringify({
          log_id: selectedLead.id,
          new_consultant_id: Number(reassignConsId),
          compensate_old_sale: compensate
        })
      });
      if (res.success) {
        toast.success(compensate
          ? 'Giao lại Tư vấn viên & Đền bù thành công!'
          : 'Giao lại Tư vấn viên thành công!'
        );
        setSelectedLead(null);
        setReassignConsId('');
        setConfirmReassignOpen(false);
        fetchLeads();
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error('Lỗi: ' + (res.message || 'Không thể giao lại')); // BUG-03 fix
      }
    } catch (err: any) {
      toast.error('Đã xảy ra lỗi: ' + err.message); // BUG-03 fix
    }
    setIsReassigning(false);
  };

  const handleBlockLead = async () => {
    if (!selectedLead) return;
    if (!blockReason.trim()) {
      toast.error('Vui lòng nhập lý do chặn.');
      return;
    }
    setIsBlocking(true);
    try {
      const res = await fetchAPI('block_lead', {
        method: 'POST',
        body: JSON.stringify({
          log_id: selectedLead.id,
          compensate_sale: compensateBlock,
          reason: blockReason.trim()
        })
      });
      if (res.success) {
        toast.success('Chặn khách hàng và đưa vào Blacklist thành công!');
        setSelectedLead(null);
        setConfirmBlockOpen(false);
        setBlockReason('');
        setCompensateBlock(false);
        fetchLeads();
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error('Lỗi: ' + (res.message || 'Không thể chặn khách hàng'));
      }
    } catch (err: any) {
      toast.error('Đã xảy ra lỗi: ' + err.message);
    }
    setIsBlocking(false);
  };

  const ITEMS_PER_PAGE = 50;

  // BUG-05 fix: Implement CSV export using Backend Stream to prevent browser/server OOM
  const handleExportCSV = () => {
    if (localStorage.getItem('DOMATION_DEMO_MODE') === 'true') {
      toast.loading('Đang chuẩn bị dữ liệu xuất CSV (Demo)...', { id: 'export' });
      try {
        if (leads.length === 0) {
          toast.error('Không có dữ liệu để xuất!', { id: 'export' });
          return;
        }

        const headers = ['ID', 'Họ Tên', 'SĐT', 'Email', 'Vòng', 'Phân bổ cho', 'Trạng thái', 'Nguồn', 'Ghi chú', 'Thời gian'];
        const rows = leads.map(lead => [
          lead.id,
          lead.name,
          lead.phone,
          lead.email,
          lead.round_name || '',
          lead.assigned_to_name || 'Chưa phân bổ',
          lead.status === 'assigned' ? 'Đã chia' :
            lead.status === 'compensation' ? 'Data Bù' :
              lead.status === 'pending' ? 'Chờ chia' :
                lead.status === 'silent' ? 'Chỉ đồng bộ' :
                  lead.status === 'reminder' ? 'Nhắc lại' : lead.status,
          lead.source || '',
          lead.note || '',
          lead.created_at
        ]);

        const csvContent = "\uFEFF" + [
          headers.join(','),
          ...rows.map(row => row.map(val => {
            const str = String(val === null || val === undefined ? '' : val).replace(/"/g, '""');
            return `"${str}"`;
          }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `export_${new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Đã tải xuống file CSV an toàn!', { id: 'export' });
      } catch (err) {
        toast.error('Có lỗi xảy ra khi xuất dữ liệu', { id: 'export' });
      }
      return;
    }

    toast.loading('Đang chuẩn bị dữ liệu xuất CSV...', { id: 'export' });
    try {
      const token = localStorage.getItem('domation_token') || '';
      const baseUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api.php` : 'https://open.domation.net/sale_data/api.php';
      const exportUrl = `${baseUrl}?action=export_csv&token=${encodeURIComponent(token)}&date=${encodeURIComponent(dateFilter)}&status=${encodeURIComponent(statusFilter)}&consultant=${encodeURIComponent(consultantFilter)}&round=${encodeURIComponent(roundFilter)}&search=${encodeURIComponent(searchTerm)}`;

      const link = document.createElement('a');
      link.href = exportUrl;
      link.setAttribute('download', `export_${new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Đang tải xuống file CSV...', { id: 'export' });
    } catch (err) {
      toast.error('Có lỗi xảy ra khi xuất dữ liệu', { id: 'export' });
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedLeads = leads;

  const getStatusBadge = (status: string, reportStatus?: string) => {
    if (status === 'error' && reportStatus === 'approved') {
      return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>Data Lỗi</span>;
    }
    switch (status) {
      case 'assigned': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>Đã chia</span>;
      case 'compensation': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#e0e7ff', color: '#4f46e5' }}>Data Bù</span>;
      case 'pending_work_hours': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#ffedd5', color: '#ea580c' }}>Chờ giờ làm</span>;
      case 'error': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>Bị Lỗi</span>;
      case 'pending': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>Chờ chia</span>;
      case 'reminder': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#fce7f3', color: '#db2777' }}>Nhắc lại</span>;
      case 'duplicate': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>Trùng lặp</span>;
      case 'rule_6_month': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Quy định 6 tháng</span>;
      case 'silent': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#e2e8f0', color: '#475569' }}>Chỉ đồng bộ</span>;
      case 'blacklisted': return <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#fee2e2', color: '#ef4444' }}>Blacklist</span>;
      default: return null;
    }
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(currentDate);

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startOffset = (firstDayOfMonth(year, month) + 6) % 7;

  // Padding for start of month
  for (let i = 0; i < startOffset; i++) {
    days.push(<div key={`empty-start-${i}`} style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', opacity: 0.3 }}></div>);
  }

  // Days of month
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = calendarData[dateStr] || { distributed: 0, blacklist: 0, reminder: 0, error: 0, ticket_total: 0 };
    const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
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
            ? 'rgba(99, 102, 241, 0.08)'
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
          {isToday && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-primary)' }}>Hôm nay</span>}
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
            }} title="Đã chia">
              <span>Chia:</span>
              <strong>{dayData.distributed}</strong>
            </div>
          )}
          {dayData.blacklist > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 4px',
              borderRadius: '4px',
              background: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              fontSize: '0.6875rem',
              fontWeight: 600
            }} title="Blacklist">
              <span>Chặn:</span>
              <strong>{dayData.blacklist}</strong>
            </div>
          )}
          {dayData.ticket_total > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 4px',
              borderRadius: '4px',
              background: '#f5f3ff',
              color: '#7c3aed',
              fontSize: '0.6875rem',
              fontWeight: 600,
              border: '1px solid #ddd6fe'
            }} title="Ticket lỗi">
              <span>Ticket:</span>
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
              background: '#fce7f3',
              color: '#db2777',
              fontSize: '0.6875rem',
              fontWeight: 600
            }} title="Nhắc lại">
              <span>Nhắc:</span>
              <strong>{dayData.reminder}</strong>
            </div>
          )}
          {dayData.error > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 4px',
              borderRadius: '4px',
              background: 'var(--color-warning-light)',
              color: 'var(--color-warning)',
              fontSize: '0.6875rem',
              fontWeight: 600
            }} title="Bị lỗi">
              <span>Lỗi:</span>
              <strong>{dayData.error}</strong>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Padding for end of month to make a perfect grid
  const totalCells = startOffset + totalDays;
  const rows = Math.ceil(totalCells / 7);
  const targetTotalCells = rows * 7;
  const endOffset = targetTotalCells - totalCells;
  for (let i = 0; i < endOffset; i++) {
    days.push(<div key={`empty-end-${i}`} style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', opacity: 0.3 }}></div>);
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)', minHeight: 0 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem', flexShrink: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={24} color="var(--color-primary)" /> Quản lý Data
          </h1>
          <p className="page-subtitle">Xem lịch sử, theo dõi tiến trình và quản lý toàn bộ dữ liệu Khách hàng.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* View Mode Toggle Buttons */}
          <div style={{
            display: 'flex',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '3px',
            marginRight: '0.5rem',
            height: '38px',
            alignItems: 'center'
          }}>
            <button
              type="button"
              className={`btn-toggle-view ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'list' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'list' ? 'white' : 'var(--color-text-muted)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '32px'
              }}
            >
              <LayoutList size={14} /> Danh sách
            </button>
            <button
              type="button"
              className={`btn-toggle-view ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'calendar' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'calendar' ? 'white' : 'var(--color-text-muted)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '32px'
              }}
            >
              <Calendar size={14} /> Lịch biểu
            </button>
          </div>

          <button className="btn outline" onClick={() => window.dispatchEvent(new CustomEvent('open-quick-add-lead'))} style={{ padding: '0 1.25rem', height: 38 }}>
            <Plus size={16} /> <span className="hidden sm:inline">Thêm Data</span>
          </button>
          <button className="btn primary" onClick={handleExportCSV} style={{ padding: '0 1.25rem', height: 38 }}>
            <Download size={16} /> Xuất CSV
          </button>
        </div>
      </div>

      {/* Mobile Filter Toggle */}
      <div className="mobile-only" style={{ marginBottom: '1rem' }}>
        <button className="btn outline" onClick={() => setShowMobileFilters(!showMobileFilters)} style={{ width: '100%', justifyContent: 'center', background: 'var(--color-surface)', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>
          <Filter size={16} /> {showMobileFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
        </button>
      </div>

      {/* Filters */}
      <div
        className={`responsive-filter-row ${!showMobileFilters ? 'hide-on-mobile' : ''}`}
        style={{
          display: viewMode === 'calendar' ? 'none' : 'flex',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          flexShrink: 0,
          flexWrap: 'wrap',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}
      >
        <div className="responsive-filter-item" style={{ position: 'relative', width: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--color-text-muted)' }} />
          <input
            className="form-input"
            placeholder="Tìm theo tên, SĐT, email..."
            style={{ paddingLeft: 36, width: '100%', height: 38, fontSize: '0.875rem' }}
            value={searchTerm}
            onChange={e => updateParams('search', e.target.value)}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect
            options={[
              { value: 'all', label: 'Tất cả thời gian', icon: <Clock size={16} /> },
              { value: 'today', label: 'Hôm nay' },
              { value: 'yesterday', label: 'Hôm qua' },
              { value: 'this_week', label: 'Tuần này' },
              { value: 'last_week', label: 'Tuần trước' },
              { value: 'two_weeks_ago', label: 'Tuần trước nữa' },
              { value: '7days', label: '7 ngày qua' },
              { value: '30days', label: '30 ngày qua' },
              { value: 'this_month', label: 'Tháng này' },
              { value: 'last_month', label: 'Tháng trước' }
            ]}
            value={dateFilter}
            onChange={val => updateParams('date', val.toString())}
            width={160}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect
            options={[
              { value: 'all', label: 'Tất cả trạng thái', icon: <Filter size={16} /> },
              { value: 'assigned', label: 'Đã chia' },
              { value: 'compensation', label: 'Data Bù' },
              { value: 'pending_work_hours', label: 'Chờ giờ làm' },
              { value: 'pending', label: 'Chờ chia' },
              { value: 'reminder', label: 'Nhắc lại' },
              { value: 'duplicate', label: 'Trùng lặp' },
              { value: 'rule_6_month', label: 'Quy định 6 tháng' },
              { value: 'silent', label: 'Chỉ đồng bộ' },
              { value: 'error', label: 'Bị Lỗi' }
            ]}
            value={statusFilter}
            onChange={val => updateParams('status', val.toString())}
            width={170}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect
            options={[
              { value: 'all', label: 'Tất cả vòng', icon: <Tag size={16} /> },
              ...rounds.map(r => ({
                value: r.round_name,
                label: r.round_name
              }))
            ]}
            value={roundFilter}
            onChange={val => updateParams('round', val.toString())}
            width={160}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect
            options={[
              { value: 'all', label: 'Tất cả TVV', icon: <User size={16} /> },
              ...consultants.map(c => ({
                value: c.name,
                label: c.name,
                avatar: c.avatar
              }))
            ]}
            value={consultantFilter}
            onChange={val => updateParams('consultant', val.toString())}
            showAvatars={true}
            searchable={true}
            width={180}
          />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Tổng cộng: <strong style={{ color: 'var(--color-text)', marginLeft: 4 }}>{totalCount}</strong> data
        </div>
      </div>

      {/* Table */}
      {viewMode === 'calendar' ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} className="fade-in-view">
          {/* Calendar Header / Control */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            marginBottom: '1rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                  {monthName} {year}
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
                Hôm nay
              </button>

              <CustomSelect
                options={[
                  { value: 'all', label: 'Tất cả TVV', icon: <User size={16} /> },
                  ...consultants.map(c => ({
                    value: c.name,
                    label: c.name,
                    avatar: c.avatar
                  }))
                ]}
                value={consultantFilter}
                onChange={val => updateParams('consultant', val.toString())}
                showAvatars={true}
                searchable={true}
                width={180}
              />
            </div>

            {/* Calendar Legend */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>Đã chia</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>Blacklist</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7c3aed' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>Ticket lỗi</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#db2777' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>Nhắc lại</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-warning)' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>Bị lỗi</span>
              </div>
            </div>
          </div>

          {/* Calendar Body */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
            {/* Calendar Grid Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              background: 'var(--color-bg)',
              borderBottom: '1px solid var(--color-border)',
              padding: '8px 0',
              flexShrink: 0
            }}>
              {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map(wd => (
                <div key={wd} style={{ padding: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: wd === 'CN' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                  {wd}
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
                <div style={{ gridColumn: 'span 7', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: 12 }}>
                  <RefreshCw size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Đang tải dữ liệu lịch biểu...</span>
                </div>
              ) : days}
            </div>
          </div>
        </div>
      ) : (
        <div className="card fade-in-view" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto' }} className="table-wrap custom-scrollbar">
            <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Khách hàng</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Liên hệ</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Trạng thái</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Phân bổ cho</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Thời gian nhận</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(8)].map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-border)', animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                        <div>
                          <div style={{ width: 120, height: 16, background: 'var(--color-border)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                          <div style={{ width: 80, height: 12, background: 'var(--color-border-light)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ width: 100, height: 16, background: 'var(--color-border)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                      <div style={{ width: 140, height: 12, background: 'var(--color-border-light)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ width: 80, height: 24, background: 'var(--color-border)', borderRadius: 12, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-border)', animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                        <div style={{ width: 90, height: 14, background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                      </div>
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ width: 110, height: 14, background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                    </td>
                  </tr>
                )) : paginatedLeads.length > 0 ? paginatedLeads.map(lead => {
                  return (
                    <tr
                      key={lead.id}
                      className="lead-row"
                      onClick={() => setSelectedLead(lead)}
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar name={lead.name} size={32} />
                          <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{lead.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                          {maskPhone(lead.phone)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{maskEmail(lead.email)}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          {getStatusBadge(lead.status, lead.report_status)}
                          {lead.report_status === 'pending' && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d' }}>Report Pending</span>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {lead.assigned_to_name !== '-' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar src={lead.assigned_to_avatar} name={lead.assigned_to_name} size={28} />
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{lead.assigned_to_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{lead.round_name}</div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>{lead.created_at}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                      Không tìm thấy dữ liệu phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 0 && (
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Hiển thị <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> trên <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{totalCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => updateParams('page', String(Math.max(currentPage - 1, 1)))}
                  disabled={currentPage === 1}
                  style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: currentPage === 1 ? 'var(--color-bg)' : 'var(--color-surface)', color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
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
                        onClick={() => updateParams('page', pageNum.toString())}
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
                <button
                  onClick={() => updateParams('page', String(Math.min(currentPage + 1, totalPages)))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: currentPage === totalPages || totalPages === 0 ? 'var(--color-bg)' : 'var(--color-surface)', color: currentPage === totalPages || totalPages === 0 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <CustomModal
        isOpen={selectedLead !== null}
        onClose={() => {
          setSelectedLead(null);
          setReassignConsId('');
        }}
        title="Chi tiết Khách hàng"
        width="850px"
      >
        {selectedLead && (
          <div style={{ padding: '1.5rem', background: 'transparent' }}>
            <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem' }}>
              {/* Cột Trái: Chi Tiết */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <Avatar name={selectedLead.name} size={48} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{selectedLead.name}</h2>
                      {user?.role === 'admin' && selectedLead.status !== 'blacklisted' && (
                        <button
                          onClick={() => {
                            setCompensateBlock(selectedLead.assigned_to_name !== '-');
                            setConfirmBlockOpen(true);
                          }}
                          title="Chặn & Blacklist khách hàng này"
                          style={{
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            color: '#ef4444',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            lineHeight: 1,
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={e => {
                            e.currentTarget.style.background = '#fca5a5';
                            e.currentTarget.style.color = '#b91c1c';
                          }}
                          onMouseOut={e => {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.color = '#ef4444';
                          }}
                        >
                          <AlertTriangle size={12} />
                          Chặn
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>ID: #{selectedLead.id}</div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Phone size={14} /> Phone</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {user?.role === 'admin' ? selectedLead.phone : maskPhone(selectedLead.phone)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Mail size={14} /> Email</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {user?.role === 'admin' ? selectedLead.email : maskEmail(selectedLead.email)}
                    </div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><ExternalLink size={14} /> Nguồn Data</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.source}</div>
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Tag size={14} /> Trạng thái</div>
                    <div>{getStatusBadge(selectedLead.status, selectedLead.report_status)}</div>
                  </div>
                </div>

                {(() => {
                  const { cleanNote, errorNotes, blacklistNotes } = parseNote(selectedLead.note || '');
                  return (
                    <>
                      {/* Clean Note Card */}
                      <div style={{
                        background: theme === 'dark' ? 'rgba(245, 158, 11, 0.08)' : 'linear-gradient(135deg, #fefce8 0%, #fffbeb 100%)',
                        border: theme === 'dark' ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid #fef3c7',
                        padding: '1.25rem',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: theme === 'dark' ? 'none' : '0 4px 15px rgba(245, 158, 11, 0.03)'
                      }}
                        className="premium-alert-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            background: theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                            padding: '8px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: theme === 'dark' ? '#f59e0b' : '#d97706'
                          }}>
                            <Tag size={18} strokeWidth={2.5} />
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme === 'dark' ? '#fbbf24' : '#92400e', letterSpacing: '-0.01em' }}>Ghi chú & Phân loại</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.85rem', color: theme === 'dark' ? '#e2e8f0' : '#78350f' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', marginRight: '6px' }}>Loại Data:</span>
                            <span style={{ fontWeight: 600 }}>{selectedLead.type !== '-' ? selectedLead.type : 'Không có'}</span>
                          </div>

                          <div style={{ borderTop: theme === 'dark' ? '1px dashed rgba(245, 158, 11, 0.2)' : '1px dashed rgba(217, 119, 6, 0.15)', paddingTop: '8px', marginTop: '4px' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', display: 'block', marginBottom: '4px' }}>Nội dung ghi chú:</span>
                            <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#f3f4f6' : '#451a03', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 500 }}>
                              {cleanNote ? cleanNote : <em style={{ color: theme === 'dark' ? '#cbd5e1' : '#b45309', opacity: 0.6 }}>Không có ghi chú thêm</em>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Error Notes (Approved / Rejected) */}
                      {errorNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          {errorNotes.map((err, index) => {
                            const isApproved = err.includes('DUYỆT');

                            // Rich harmonious color palettes
                            const colors = isApproved ? (
                              theme === 'dark' ? {
                                gradient: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.15)',
                                glow: 'none',
                                accent: '#34d399',
                                title: '#34d399',
                                text: '#e2e8f0',
                                badgeBg: 'rgba(16, 185, 129, 0.15)',
                                badgeText: '#34d399',
                                badgeBorder: '1px solid rgba(16, 185, 129, 0.2)',
                                iconBg: 'rgba(16, 185, 129, 0.15)',
                              } : {
                                gradient: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                                border: '1px solid #a7f3d0',
                                glow: '0 4px 15px rgba(16, 185, 129, 0.04)',
                                accent: '#10b981',
                                title: '#065f46',
                                text: '#047857',
                                badgeBg: '#d1fae5',
                                badgeText: '#065f46',
                                badgeBorder: '1px solid #a7f3d0',
                                iconBg: '#d1fae5',
                              }
                            ) : (
                              theme === 'dark' ? {
                                gradient: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.15)',
                                glow: 'none',
                                accent: '#f87171',
                                title: '#f87171',
                                text: '#e2e8f0',
                                badgeBg: 'rgba(239, 68, 68, 0.15)',
                                badgeText: '#f87171',
                                badgeBorder: '1px solid rgba(239, 68, 68, 0.2)',
                                iconBg: 'rgba(239, 68, 68, 0.15)',
                              } : {
                                gradient: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
                                border: '1px solid #fecaca',
                                glow: '0 4px 15px rgba(244, 63, 94, 0.04)',
                                accent: '#f43f5e',
                                title: '#9f1239',
                                text: '#be123c',
                                badgeBg: '#ffe4e6',
                                badgeText: '#9f1239',
                                badgeBorder: '1px solid #fca5a5',
                                iconBg: '#ffe4e6',
                              }
                            );

                            const IconComponent = isApproved ? CheckCircle2 : XCircle;

                            const { cleanText, admin: noteAdmin, time: noteTime } = parseErrorNote(err);
                            const displayAdmin = noteAdmin || selectedLead?.resolved_by || 'Hệ thống';

                            let displayTime = noteTime;
                            if (!displayTime) {
                              if (selectedLead?.resolved_at) {
                                try {
                                  const dt = new Date(selectedLead.resolved_at.replace(/-/g, '/'));
                                  if (!isNaN(dt.getTime())) {
                                    displayTime = dt.toLocaleString('vi-VN');
                                  } else {
                                    displayTime = selectedLead.resolved_at;
                                  }
                                } catch (e) {
                                  displayTime = selectedLead.resolved_at;
                                }
                              } else {
                                displayTime = 'Hệ thống';
                              }
                            }

                            let cleanMsg = cleanText;
                            if (cleanMsg.startsWith('[LỖI -')) {
                              const bracketIndex = cleanMsg.indexOf(']');
                              if (bracketIndex !== -1) {
                                cleanMsg = cleanMsg.substring(bracketIndex + 1).trim();
                                if (cleanMsg.startsWith(':')) {
                                  cleanMsg = cleanMsg.substring(1).trim();
                                }
                              }
                            }

                            const msgParts = cleanMsg.split(' | ');
                            const coreError = msgParts[0] || '';
                            const actionReason = msgParts[1] || '';

                            return (
                              <div key={index} style={{
                                background: colors.gradient,
                                border: colors.border,
                                boxShadow: colors.glow,
                                padding: '1.25rem',
                                borderRadius: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                position: 'relative'
                              }}
                                className="premium-alert-card"
                              >
                                {/* Top header info */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                      background: colors.iconBg,
                                      padding: '8px',
                                      borderRadius: '10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: colors.accent
                                    }}>
                                      <IconComponent size={18} strokeWidth={2.5} />
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.title, letterSpacing: '-0.01em' }}>
                                      {isApproved ? 'Thông tin lỗi - Đã Duyệt' : 'Thông tin lỗi - Từ Chối'}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: colors.badgeText,
                                    background: colors.badgeBg,
                                    border: colors.badgeBorder,
                                    padding: '3px 8px',
                                    borderRadius: '8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    {isApproved ? 'Đã duyệt' : 'Từ chối'}
                                  </span>
                                </div>

                                {/* Content block */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#cbd5e1' : '#1e293b', fontWeight: 500, lineHeight: 1.5 }}>
                                    Lỗi: <span style={{ fontWeight: 600, color: colors.text }}>{coreError}</span>
                                  </div>
                                  {actionReason && (
                                    <div style={{
                                      fontSize: '0.85rem',
                                      color: theme === 'dark' ? '#9ca3af' : '#475569',
                                      fontWeight: 400,
                                      lineHeight: 1.5,
                                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.4)',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: theme === 'dark' ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px dashed rgba(0, 0, 0, 0.05)',
                                      marginTop: 2
                                    }}>
                                      <strong>Lý do từ chối / Duyệt:</strong> {actionReason.trim()}
                                    </div>
                                  )}
                                </div>

                                {/* Footer metadata */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  paddingTop: '0.75rem',
                                  marginTop: '0.25rem',
                                  borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)',
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Avatar name={displayAdmin} size={16} />
                                    <span>Xử lý bởi: <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{displayAdmin}</strong></span>
                                  </div>
                                  <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Clock size={13} style={{ opacity: 0.7 }} />
                                    <span>Thời gian: <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{displayTime}</strong></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Blacklist Notes */}
                      {blacklistNotes && blacklistNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          {blacklistNotes.map((note, index) => {
                            const parsed = parseBlacklistNote(note);
                            const blacklistColors = theme === 'dark' ? {
                              gradient: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.15)',
                              glow: 'none',
                              accent: '#f87171',
                              title: '#f87171',
                              text: '#e2e8f0',
                              badgeBg: 'rgba(239, 68, 68, 0.15)',
                              badgeText: '#f87171',
                              badgeBorder: '1px solid rgba(239, 68, 68, 0.2)',
                              iconBg: 'rgba(239, 68, 68, 0.15)',
                            } : {
                              gradient: 'linear-gradient(135deg, #fff1f2 0%, #fff5f5 100%)',
                              border: '1px solid #fecaca',
                              glow: '0 4px 15px rgba(244, 63, 94, 0.04)',
                              accent: '#f43f5e',
                              title: '#9f1239',
                              text: '#be123c',
                              badgeBg: '#ffe4e6',
                              badgeText: '#9f1239',
                              badgeBorder: '1px solid #fca5a5',
                              iconBg: '#ffe4e6',
                            };

                            return (
                              <div key={index} style={{
                                background: blacklistColors.gradient,
                                border: blacklistColors.border,
                                boxShadow: blacklistColors.glow,
                                padding: '1.25rem',
                                borderRadius: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                position: 'relative'
                              }}
                                className="premium-alert-card"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                      background: blacklistColors.iconBg,
                                      padding: '8px',
                                      borderRadius: '10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: blacklistColors.accent
                                    }}>
                                      <ShieldAlert size={18} strokeWidth={2.5} />
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: blacklistColors.title, letterSpacing: '-0.01em' }}>
                                      Thông tin chặn (Blacklist)
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: blacklistColors.badgeText,
                                    background: blacklistColors.badgeBg,
                                    border: blacklistColors.badgeBorder,
                                    padding: '3px 8px',
                                    borderRadius: '8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    Bị Chặn
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {parsed.reason && (
                                    <div style={{
                                      fontSize: '0.875rem',
                                      color: theme === 'dark' ? '#9ca3af' : '#1e293b',
                                      fontWeight: 500,
                                      lineHeight: 1.5,
                                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.4)',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: theme === 'dark' ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px dashed rgba(0, 0, 0, 0.05)'
                                    }}>
                                      <strong>Lý do chặn:</strong> <span style={{ color: blacklistColors.text, fontWeight: 600 }}>{parsed.reason}</span>
                                    </div>
                                  )}
                                </div>

                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  paddingTop: '0.75rem',
                                  marginTop: '0.25rem',
                                  borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)',
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Avatar name={parsed.admin} size={16} />
                                    <span>Chặn bởi: <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{parsed.admin}</strong></span>
                                  </div>
                                  <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Clock size={13} style={{ opacity: 0.7 }} />
                                    <span>Thời gian: <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{parsed.time}</strong></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Cột Phải: Phân bổ */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>Thông tin Phân bổ</h3>

                {selectedLead.assigned_to_name !== '-' ? (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src={selectedLead.assigned_to_avatar} name={selectedLead.assigned_to_name} size={36} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Người tiếp nhận</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{selectedLead.assigned_to_name}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> Vòng chia</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.round_name}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Clock size={12} /> Thời gian nhận</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.created_at}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--color-bg)', padding: '1.5rem', borderRadius: 12, textAlign: 'center', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    Chưa có thông tin phân bổ cho Khách hàng này.
                  </div>
                )}

                {/* Reassignment section */}
                <div style={{ marginTop: '1.5rem', background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={16} color="var(--color-primary)" /> Giao lại Tư vấn viên
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
                    Thay đổi người tiếp nhận (Không ảnh hưởng lượt chia).
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <CustomSelect
                      options={[
                        { value: '', label: '-- Chọn Tư vấn viên --' },
                        ...consultants
                          .filter(c => c.name !== selectedLead?.assigned_to_name)
                          .map(c => ({
                            value: c.id.toString(),
                            label: c.name,
                            avatar: c.avatar
                          }))
                      ]}
                      value={reassignConsId}
                      onChange={val => setReassignConsId(val.toString())}
                      showAvatars={true}
                      searchable={true}
                      width="100%"
                      direction="up"
                    />
                    <button
                      className="btn primary"
                      onClick={() => setConfirmReassignOpen(true)}
                      disabled={isReassigning || !reassignConsId}
                      style={{ height: 38, background: 'var(--color-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '0 1rem', fontSize: '0.875rem', fontWeight: 700, width: '100%' }}
                    >
                      {isReassigning ? <RefreshCw size={14} className="spin" /> : null}
                      Xác nhận giao
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </CustomModal>

      <CustomModal
        isOpen={confirmReassignOpen}
        onClose={() => setConfirmReassignOpen(false)}
        title="Xác nhận Giao lại Lead"
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p style={{ color: 'var(--color-text)', lineHeight: 1.6, fontSize: '0.9375rem', margin: 0 }}>
                Bạn có chắc chắn muốn chuyển quyền chăm sóc Lead <strong>"{selectedLead?.name}"</strong> sang cho Tư vấn viên <strong>"{consultants.find(c => Number(c.id) === Number(reassignConsId))?.name}"</strong>?
              </p>
              {selectedLead?.assigned_to_name && selectedLead.assigned_to_name !== '-' && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 8, marginBottom: 0 }}>
                  Tư vấn viên hiện tại: <strong>{selectedLead.assigned_to_name}</strong>. Chọn hình thức giao lại:
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn outline" onClick={() => setConfirmReassignOpen(false)}>Hủy</button>

            {selectedLead?.assigned_to_name && selectedLead.assigned_to_name !== '-' ? (
              <>
                <button
                  className="btn secondary"
                  onClick={() => handleReassign(false)}
                  style={{ background: '#f59e0b', color: '#fff', border: 'none' }}
                  disabled={isReassigning}
                >
                  Giao lại luôn
                </button>
                <button
                  className="btn success"
                  onClick={() => handleReassign(true)}
                  style={{ background: '#10b981', color: '#fff', border: 'none' }}
                  disabled={isReassigning}
                >
                  Giao lại và bù vòng cho TVV
                </button>
              </>
            ) : (
              <button
                className="btn primary"
                onClick={() => handleReassign(false)}
                disabled={isReassigning}
              >
                Xác nhận chuyển
              </button>
            )}
          </div>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={confirmBlockOpen}
        onClose={() => {
          setConfirmBlockOpen(false);
          setBlockReason('');
          setCompensateBlock(false);
        }}
        title="Xác nhận Chặn & Blacklist"
        width="550px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: '#fee2e2',
              color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p style={{ color: 'var(--color-text)', lineHeight: 1.6, fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>
                Bạn có chắc chắn muốn chặn khách hàng "{selectedLead?.name}"?
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4, marginBottom: 0 }}>
                Số điện thoại/Email của khách hàng sẽ được thêm vào Blacklist toàn cục để chặn nhận trùng trong tương lai.
              </p>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Hình thức chặn:</div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="blockType"
                checked={!compensateBlock}
                onChange={() => setCompensateBlock(false)}
                style={{ marginTop: '3px' }}
              />
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Chỉ đưa vào danh sách đen (Blacklist)</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>Không thực hiện đền bù data cho Sale.</p>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: selectedLead?.assigned_to_name === '-' ? 'not-allowed' : 'pointer', opacity: selectedLead?.assigned_to_name === '-' ? 0.5 : 1 }}>
              <input
                type="radio"
                name="blockType"
                checked={compensateBlock}
                onChange={() => setCompensateBlock(true)}
                disabled={selectedLead?.assigned_to_name === '-'}
                style={{ marginTop: '3px' }}
              />
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Chặn và Bù vòng cho Sale</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                  Đền bù 1 lượt data vòng <strong>"{selectedLead?.round_name}"</strong> cho Sale <strong>"{selectedLead?.assigned_to_name}"</strong>.
                </p>
              </div>
            </label>

            {selectedLead?.assigned_to_name === '-' && (
              <div style={{ color: '#ea580c', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> Lead chưa phân bổ cho Sale nào, không thể chọn hình thức Bù vòng.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Lý do chặn <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Nhập lý do chặn (ví dụ: Số điện thoại ảo, khách không có nhu cầu, spam...)"
              style={{
                width: '100%',
                height: '80px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                fontSize: '0.875rem',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              className="btn outline"
              onClick={() => {
                setConfirmBlockOpen(false);
                setBlockReason('');
                setCompensateBlock(false);
              }}
              disabled={isBlocking}
            >
              Hủy
            </button>
            <button
              className="btn danger"
              onClick={handleBlockLead}
              disabled={isBlocking || !blockReason.trim()}
              style={{ background: '#ef4444', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {isBlocking ? <RefreshCw size={14} className="spin" /> : null}
              Xác nhận chặn
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Day Details Modal */}
      <CustomModal
        isOpen={selectedDate !== null}
        onClose={() => {
          setSelectedDate(null);
          setDayDetails(null);
          setActiveModalTab('sales');
        }}
        title={`Chi tiết hoạt động ngày ${selectedDate ? new Date(selectedDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}`}
        width="900px"
      >
        {dayDetailsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: 12 }}>
            <RefreshCw size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Đang tải dữ liệu chi tiết...</span>
          </div>
        ) : dayDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '580px', margin: '-1.5rem', overflow: 'hidden' }}>
            {/* Modal Tabs */}
            <div style={{
              display: 'flex',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '3px',
              gap: '4px',
              flexShrink: 0,
              margin: '1.5rem 1.5rem 1rem 1.5rem',
              height: '38px',
              alignItems: 'center'
            }}>
              <button
                type="button"
                onClick={() => setActiveModalTab('sales')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeModalTab === 'sales' ? 'var(--color-primary)' : 'transparent',
                  color: activeModalTab === 'sales' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '32px',
                  flex: 1
                }}
                className="modal-tab-button"
              >
                <span>Phân bổ cho Sale</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: activeModalTab === 'sales' ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-border-light)',
                  color: activeModalTab === 'sales' ? 'white' : 'var(--color-text-muted)',
                  padding: '1px 6px',
                  borderRadius: '5px',
                  transition: 'all 0.2s'
                }}>
                  {dayDetails.sales?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('tickets')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeModalTab === 'tickets' ? 'var(--color-primary)' : 'transparent',
                  color: activeModalTab === 'tickets' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '32px',
                  flex: 1
                }}
                className="modal-tab-button"
              >
                <span>Ticket Lỗi</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: activeModalTab === 'tickets' ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-border-light)',
                  color: activeModalTab === 'tickets' ? 'white' : 'var(--color-text-muted)',
                  padding: '1px 6px',
                  borderRadius: '5px',
                  transition: 'all 0.2s'
                }}>
                  {dayDetails.tickets?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('blacklist')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeModalTab === 'blacklist' ? 'var(--color-primary)' : 'transparent',
                  color: activeModalTab === 'blacklist' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '32px',
                  flex: 1
                }}
                className="modal-tab-button"
              >
                <span>Blacklist & Lỗi Hệ Thống</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: activeModalTab === 'blacklist' ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-border-light)',
                  color: activeModalTab === 'blacklist' ? 'white' : 'var(--color-text-muted)',
                  padding: '1px 6px',
                  borderRadius: '5px',
                  transition: 'all 0.2s'
                }}>
                  {dayDetails.blacklist_logs?.length || 0}
                </span>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem 1.5rem' }} className="custom-scrollbar">
              {activeModalTab === 'sales' && (
                <div>
                  {dayDetails.sales && dayDetails.sales.length > 0 ? (
                    <div className="premium-table-container">
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th style={{ width: '45%' }}>Tư vấn viên</th>
                            <th style={{ width: '25%' }}>Vòng</th>
                            <th style={{ width: '15%' }}>Trạng thái</th>
                            <th style={{ width: '15%', textAlign: 'right' }}>Số lượng data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayDetails.sales.map((item: any, idx: number) => (
                            <tr key={idx}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                  <Avatar src={item.sale_avatar} name={item.sale_name} size={30} />
                                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{item.sale_name}</span>
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  background: 'var(--color-primary-light)',
                                  color: 'var(--color-primary)',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600
                                }}>
                                  {item.round_name}
                                </span>
                              </td>
                              <td>{getStatusBadge(item.status)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{item.count}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                      <User size={40} style={{ marginBottom: 12, color: 'var(--color-text-muted)', opacity: 0.6 }} />
                      <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Không có lịch sử chia data cho tư vấn viên nào vào ngày này.</p>
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'tickets' && (
                <div>
                  {dayDetails.tickets && dayDetails.tickets.length > 0 ? (
                    <div className="premium-table-container">
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th style={{ width: '25%' }}>Khách hàng</th>
                            <th style={{ width: '22%' }}>Tư vấn viên báo cáo</th>
                            <th style={{ width: '28%' }}>Lý do lỗi</th>
                            <th style={{ width: '13%' }}>Trạng thái</th>
                            <th style={{ width: '12%', textAlign: 'right' }}>Thời gian báo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayDetails.tickets.map((item: any, idx: number) => {
                            const showPhone = user?.role === 'admin' ? item.phone : maskPhone(item.phone);
                            return (
                              <tr key={idx}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Avatar name={item.lead_name} size={32} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{item.lead_name}</span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                                        <Phone size={11} style={{ opacity: 0.6 }} />
                                        {showPhone}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Avatar src={item.sale_avatar} name={item.sale_name} size={24} />
                                    <span style={{ fontWeight: 500, color: 'var(--color-text)', fontSize: '0.85rem' }}>{item.sale_name}</span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-light)',
                                    lineHeight: 1.4,
                                    maxWidth: '240px',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal'
                                  }}>
                                    {item.reason}
                                  </div>
                                </td>
                                <td>
                                  {item.status === 'pending' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.2)' }}>Chờ duyệt</span>}
                                  {item.status === 'approved' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>Đã duyệt</span>}
                                  {item.status === 'rejected' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>Từ chối</span>}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    <Clock size={11} style={{ opacity: 0.6 }} />
                                    <span>{item.created_at ? item.created_at.split(' ')[1] || item.created_at : ''}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                      <AlertTriangle size={40} style={{ marginBottom: 12, color: 'var(--color-text-muted)', opacity: 0.6 }} />
                      <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Không có báo cáo ticket lỗi dữ liệu nào trong ngày này.</p>
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'blacklist' && (
                <div>
                  {dayDetails.blacklist_logs && dayDetails.blacklist_logs.length > 0 ? (
                    <div className="premium-table-container">
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th style={{ width: '32%' }}>Khách hàng</th>
                            <th style={{ width: '13%' }}>Loại</th>
                            <th style={{ width: '43%' }}>Thông điệp hệ thống</th>
                            <th style={{ width: '12%', textAlign: 'right' }}>Thời gian</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayDetails.blacklist_logs.map((item: any, idx: number) => {
                            const showPhone = user?.role === 'admin' ? item.phone : maskPhone(item.phone);
                            const showEmail = user?.role === 'admin' ? item.email : maskEmail(item.email);
                            return (
                              <tr key={idx}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Avatar name={item.lead_name} size={32} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{item.lead_name}</span>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {showPhone && showPhone !== '-' && (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                                            <Phone size={10} style={{ opacity: 0.6 }} />
                                            {showPhone}
                                          </span>
                                        )}
                                        {showEmail && showEmail !== '-' && (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                                            <Mail size={10} style={{ opacity: 0.6 }} />
                                            {showEmail}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>{getStatusBadge(item.status)}</td>
                                <td>
                                  <div style={{
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-light)',
                                    lineHeight: 1.4,
                                    maxWidth: '360px',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal'
                                  }}>
                                    {item.message}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    <Clock size={11} style={{ opacity: 0.6 }} />
                                    <span>{item.received_at ? item.received_at.split(' ')[1] || item.received_at : ''}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                      <ShieldAlert size={40} style={{ marginBottom: 12, color: 'var(--color-text-muted)', opacity: 0.6 }} />
                      <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Không phát hiện trường hợp Blacklist hay Lỗi hệ thống nào vào ngày này.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border-light)',
              background: 'var(--color-bg)',
              flexShrink: 0
            }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setSelectedDate(null);
                  setDayDetails(null);
                  setActiveModalTab('sales');
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Có lỗi xảy ra khi hiển thị chi tiết.
          </div>
        )}
      </CustomModal>

      <style>{`
        :root {
          --color-calendar-weekend: #f1f0f4;
        }
        [data-theme="dark"] {
          --color-calendar-weekend: #141b2d;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .lead-row:hover { background: var(--color-bg) !important; }
        .calendar-day-cell {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .calendar-day-cell:hover {
          background-color: var(--color-surface-hover) !important;
          box-shadow: inset 0 0 0 2px var(--color-primary-light), 0 8px 24px rgba(99, 102, 241, 0.08);
          z-index: 10;
          transform: translateY(-2px);
        }
        .fade-in-view {
          animation: fadeInView 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInView {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .calendar-day-cell div > div {
          transition: all 0.15s ease-in-out;
          border-radius: 6px !important;
        }
        .calendar-day-cell div > div:hover {
          transform: scale(1.05);
          filter: brightness(0.96);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }
        
        /* Premium Table Styles for Day Details Modal */
        .premium-table-container {
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--color-surface);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.015);
        }
        .premium-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .premium-table th {
          background: var(--color-border-light);
          padding: 12px 16px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--color-border);
        }
        .premium-table td {
          padding: 14px 16px;
          font-size: 0.875rem;
          color: var(--color-text);
          border-bottom: 1px solid var(--color-border-light);
          vertical-align: middle;
        }
        .premium-table tr:last-child td {
          border-bottom: none;
        }
        .premium-table tr {
          transition: background-color 0.15s ease;
        }
        .premium-table tr:hover {
          background-color: rgba(124, 58, 237, 0.02);
        }
        .modal-tab-button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .modal-tab-button:hover {
          color: var(--color-primary) !important;
        }
        [data-theme="dark"] .premium-table tr:hover {
          background-color: rgba(124, 58, 237, 0.05);
        }
      `}</style>
    </div>
  );
};
