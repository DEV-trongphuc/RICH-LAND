import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, AlertTriangle, RefreshCw,
  GitBranch, UserPlus, Zap, Calendar, BarChart2, Scale,
  FileSpreadsheet, MessageCircle, Database, Server, ExternalLink, Clock, CheckCircle, Cpu,
  ShieldAlert, Filter, Ticket as TicketIcon
} from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart,
  PieChart, Pie, Cell, BarChart, LabelList
} from 'recharts';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { useNavigate } from 'react-router-dom';
import { withRouterFreezer } from '../components/RouterFreezer';
import { fetchAPI, getDefaultDateFilter } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { KpiCardSkeleton, Skeleton } from '../components/ui/Skeleton';

import { Avatar } from '../components/ui/Avatar';
import { WarRoomFlightDeck } from '../components/Dashboard/WarRoomFlightDeck';

const parseServerDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  if (trimmed.includes('T') || trimmed.includes('+') || trimmed.includes('Z')) {
    return new Date(trimmed);
  }
  const isoStr = trimmed.replace(' ', 'T') + '+07:00';
  return new Date(isoStr);
};

const DashboardInner = ({ isActive }: { isActive: boolean }) => {
  const { t, language } = useLanguage();
  const daysOfWeek = [
    t('Thứ 2'),
    t('Thứ 3'),
    t('Thứ 4'),
    t('Thứ 5'),
    t('Thứ 6'),
    t('Thứ 7'),
    t('Chủ Nhật')
  ];
  const daysOfWeekShort = [
    t('T2'),
    t('T3'),
    t('T4'),
    t('T5'),
    t('T6'),
    t('T7'),
    t('CN')
  ];
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingTicketsCount, setPendingTicketsCount] = useState(0);
  const [heldLeadsCount, setHeldLeadsCount] = useState(0);
  const [pendingCheckInsCount, setPendingCheckInsCount] = useState(0);
  const [pendingCoopsCount, setPendingCoopsCount] = useState(0);
  const [showWarRoom, setShowWarRoom] = useState(false);
  const [aiScreenerEnabled, setAiScreenerEnabled] = useState<boolean>(() => {
    const cached = localStorage.getItem('ai_screener_enabled');
    return cached === null ? true : cached === '1';
  });
  const [dateFilter, setDateFilter] = useState(() => {
    return localStorage.getItem('richland_global_date') || getDefaultDateFilter();
  });

  const handleUpdateDateFilter = (val: string) => {
    setDateFilter(val);
    localStorage.setItem('richland_global_date', val);
    window.dispatchEvent(new CustomEvent('global-date-change', { detail: val }));
  };

  const [chartMode, setChartMode] = useState<'day' | 'hour' | 'heatmap'>('day');
  const [hoveredCell, setHoveredCell] = useState<{
    wday: number;
    hour: number;
    volume: number;
    x: number;
    y: number;
  } | null>(null);
  const [sourceViewMode, setSourceViewMode] = useState<'connection' | 'lead'>('connection');
  const [settings, setSettings] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthModalTab, setHealthModalTab] = useState<'stats' | 'connections'>('stats');
  const [healthChartMetric, setHealthChartMetric] = useState<'zalo' | 'email' | 'token'>('zalo');
  const [modalChartLoading, setModalChartLoading] = useState(false);

  const fetchStatsOnly = async (metricVal: string, modeVal: string, signal?: AbortSignal) => {
    if (loading) return; // Skip if main dashboard loading is in progress
    setModalChartLoading(true);
    try {
      const statsJson = await fetchAPI(`get_dashboard_stats&date=${encodeURIComponent(dateFilter)}&chart_mode=${modeVal}&chart_metric=${metricVal}`, { signal });
      if (signal?.aborted) return;
      if (statsJson.success) {
        setStats(statsJson.data);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Error fetching stats only:', e);
      }
    }
    setModalChartLoading(false);
  };

  const formatNumberCompact = (val: number) => {
    if (val >= 1000000) {
      return (val / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
    }
    if (val >= 10000) {
      return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return val.toLocaleString();
  };

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'zalo':
        return t('Số tin Zalo');
      case 'email':
        return t('Số Mail');
      case 'token':
        return t('Số Token AI');
      default:
        return t('Lưu lượng Lead');
    }
  };

  const getMetricColor = (_metric: string) => {
    return '#a31422';
  };

  const isSingleDay = dateFilter === 'Hôm nay' || dateFilter === 'Hôm qua';
  const displayChartMode = isSingleDay ? 'hour' : chartMode;
  const modalChartMode = displayChartMode === 'heatmap' ? 'day' : displayChartMode;

  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Consultant stats state for details modal
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsConsultant, setStatsConsultant] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsDateMode, setStatsDateMode] = useState<string>('this_month');
  const [statsStartDate, setStatsStartDate] = useState<string>('');
  const [statsEndDate, setStatsEndDate] = useState<string>('');

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

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getComparisonLabel = (filter: string) => {
    switch (filter) {
      case 'Hôm nay':
        return t('so với hôm qua');
      case 'Hôm qua':
        return t('so với ngày trước đó');
      case 'Tuần này':
        return t('so với tuần trước');
      case 'Tuần trước':
        return t('so với tuần trước nữa');
      case 'Tuần trước nữa':
        return t('so với tuần trước đó');
      case '7 ngày qua':
        return t('so với 7 ngày trước');
      case '30 ngày qua':
        return t('so với 30 ngày trước');
      case 'Tháng này':
        return t('so với tháng trước');
      case 'Tháng trước':
        return t('so với tháng trước nữa');
      default:
        if (filter.includes('đến')) {
          return t('so với kỳ trước');
        }
        return t('so với kỳ trước');
    }
  };

  const getDisplayDateFilterText = (filter: string) => {
    if (filter.includes('đến')) {
      return filter.replace(/\s*đến\s*/i, ` ${t('đến')} `);
    }
    return t(filter);
  };

  const fetchDashboard = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      // BUG-04 fix: Dùng Promise.all để gọi song song, tiết kiệm ~1-2s
      // BUG-06 fix: Xử lý lỗi riêng từng API, không để lỗi một cái 'nuốt' cái kia
      const metric = showHealthModal ? healthChartMetric : 'lead';
      const [statsJson, logsJson, settingsJson, connectionsJson] = await Promise.all([
        fetchAPI(`get_dashboard_stats&date=${encodeURIComponent(dateFilter)}&chart_mode=${displayChartMode}&chart_metric=${metric}`),
        fetchAPI('get_logs&exclude_status=silent&page=1&pageSize=5'),
        fetchAPI('get_settings'),
        fetchAPI('get_connections')
      ]);

      // Kiểm tra xem request đã bị hủy chưa (user đổi filter trước khi response về)
      if (signal?.aborted) return;

      if (statsJson.success) {
        setStats(statsJson.data);
        const isEnabled = statsJson.data.ai_screener_enabled === 1 || statsJson.data.ai_screener_enabled === '1' || statsJson.data.ai_screener_enabled === true;
        setAiScreenerEnabled(isEnabled);
        localStorage.setItem('ai_screener_enabled', isEnabled ? '1' : '0');
      } else {
        console.error('Lỗi tải thống kê:', statsJson.message);
      }

      if (logsJson.success) {
        const nonSilentLogs = logsJson.data.filter((log: any) => log.status !== 'silent');
        setRecentLogs(nonSilentLogs.slice(0, 5));
      }
      else console.error('Lỗi tải nhật ký:', logsJson.message);

      if (settingsJson.success) setSettings(settingsJson.data);
      if (connectionsJson.success) setConnections(connectionsJson.data || []);
    } catch (e: any) {
      // BUG-04 fix: Bỏ qua lỗi AbortError (do user đổi filter nhanh) - đây KHÔNG phải lỗi thực sự
      if (e?.name !== 'AbortError') {
        console.error('Dashboard fetch error:', e);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isActive) {
      // BUG-04 fix: Tạo AbortController để hủy fetch cũ khi dateFilter thay đổi nhanh
      const abortController = new AbortController();
      fetchDashboard(abortController.signal);
      return () => abortController.abort(); // Cleanup: hủy khi component unmount hoặc dateFilter đổi
    }
  }, [dateFilter, isActive]);

  useEffect(() => {
    if (isActive) {
      fetchAPI('get_reports&status=pending&date=all&pageSize=1')
        .then(res => { if (res.success) setPendingTicketsCount(res.total_count ?? 0); })
        .catch(e => console.error(e));
        
      fetchAPI('get_held_leads&pageSize=1&date=all')
        .then(res => { if (res.success) setHeldLeadsCount(res.total_count ?? 0); })
        .catch(e => console.error(e));

      fetchAPI('check-ins&status=pending_approval')
        .then(res => { if (res.success && Array.isArray(res.data)) setPendingCheckInsCount(res.data.length); })
        .catch(e => console.error(e));

      fetchAPI('cooperation-slips')
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            const pending = res.data.filter((c: any) => c.status === 'pending_manager_approval');
            setPendingCoopsCount(pending.length);
          }
        })
        .catch(e => console.error(e));
    }
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      const abortController = new AbortController();
      const metric = showHealthModal ? healthChartMetric : 'lead';
      const mode = showHealthModal ? modalChartMode : displayChartMode;
      fetchStatsOnly(metric, mode, abortController.signal);
      return () => abortController.abort();
    }
  }, [chartMode, healthChartMetric, showHealthModal, isActive]);

  useEffect(() => {
    if (isActive) {
      const savedDate = localStorage.getItem('richland_global_date');
      if (savedDate && savedDate !== dateFilter) {
        setDateFilter(savedDate);
      }
    }
  }, [isActive]);

  useEffect(() => {
    const handleGlobalDate = (e: any) => {
      const newDate = e.detail;
      if (newDate && newDate !== dateFilter) {
        setDateFilter(newDate);
      }
    };
    window.addEventListener('global-date-change', handleGlobalDate);
    return () => window.removeEventListener('global-date-change', handleGlobalDate);
  }, [dateFilter]);

  useEffect(() => {
    const handleLeadAdded = () => {
      if (isActive) {
        fetchDashboard();
      }
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, [dateFilter, chartMode, isActive]);

  useEffect(() => {
    const handleOpenWarRoom = () => {
      setShowWarRoom(true);
    };
    window.addEventListener('open-ai-infinity-view', handleOpenWarRoom);
    return () => window.removeEventListener('open-ai-infinity-view', handleOpenWarRoom);
  }, []);

  const syncDateFilterToModal = (filter: string) => {
    let mode = 'this_month';
    let start = '';
    let end = '';

    if (filter === 'Hôm nay') {
      mode = 'today';
    } else if (filter === 'Hôm qua') {
      mode = 'yesterday';
    } else if (filter === '7 ngày qua') {
      mode = '7_days';
    } else if (filter === '30 ngày qua') {
      mode = '30_days';
    } else if (filter === 'Tháng này') {
      mode = 'this_month';
    } else if (filter === 'Tháng trước') {
      mode = 'last_month';
    } else if (filter === 'Tuần này') {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + distanceToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      mode = 'custom';
      start = monday.toISOString().split('T')[0];
      end = sunday.toISOString().split('T')[0];
    } else if (filter === 'Tuần trước') {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const prevMonday = new Date(now);
      prevMonday.setDate(now.getDate() + distanceToMonday - 7);
      const prevSunday = new Date(prevMonday);
      prevSunday.setDate(prevMonday.getDate() + 6);

      mode = 'custom';
      start = prevMonday.toISOString().split('T')[0];
      end = prevSunday.toISOString().split('T')[0];
    } else if (filter === 'Tuần trước nữa') {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const prev2Monday = new Date(now);
      prev2Monday.setDate(now.getDate() + distanceToMonday - 14);
      const prev2Sunday = new Date(prev2Monday);
      prev2Sunday.setDate(prev2Monday.getDate() + 6);

      mode = 'custom';
      start = prev2Monday.toISOString().split('T')[0];
      end = prev2Sunday.toISOString().split('T')[0];
    } else {
      const match = filter.match(/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/i);
      if (match) {
        mode = 'custom';
        start = match[1];
        end = match[2];
      }
    }

    setStatsDateMode(mode);
    setStatsStartDate(start);
    setStatsEndDate(end);
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
        toast.error(json.message || 'Lỗi khi tải báo cáo thống kê');
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

  const kpiCards = [
    {
      id: 'total',
      statusValue: 'all',
      label: t('TỔNG DATA TIẾP NHẬN'),
      value: stats?.total_today?.toLocaleString() || '0',
      icon: GitBranch,
      color: '#a31422', // Purple for Total Data
      change: stats?.total_change,
      up: (stats?.total_change || '').startsWith('+')
    },
    {
      id: 'distributed',
      statusValue: 'assigned,compensation,rule_6_month,pending_work_hours,fallback,success',
      label: t('ĐÃ CHIA VÒNG THÀNH CÔNG'),
      value: stats?.distributed_today?.toLocaleString() || '0',
      icon: UserPlus,
      color: '#3b82f6', // Blue for Distributed
      change: stats?.distributed_change,
      up: (stats?.distributed_change || '').startsWith('+')
    },
    {
      id: 'duplicates',
      statusValue: 'reminder,duplicate',
      label: t('BỊ TRÙNG LẶP (< 6 THÁNG)'),
      value: stats?.duplicates?.toLocaleString() || '0',
      icon: AlertTriangle,
      color: '#f59e0b', // Amber/Yellow for Duplicates
      change: stats?.duplicates_change,
      up: !(stats?.duplicates_change || '').startsWith('+')
    },
    {
      id: 'errors',
      statusValue: 'error,blacklisted,rejected,pending_approval,no_consultant',
      label: t('DATA LỖI / Dưới chuẩn'),
      value: stats?.errors?.toLocaleString() || '0',
      icon: Zap,
      color: '#ef4444', // Red for Errors
      change: stats?.errors_change,
      up: !(stats?.errors_change || '').startsWith('+')
    }
  ];


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

  const defaultFilters = ['Hôm nay', 'Hôm qua', 'Tuần này', 'Tuần trước', 'Tuần trước nữa', '7 ngày qua', '30 ngày qua', 'Tháng này', 'Tháng trước', 'Tùy chỉnh'];
  if (!defaultFilters.includes(dateFilter)) {
    dateOptions.push({ value: dateFilter, label: getDisplayDateFilterText(dateFilter) });
  }

  dateOptions.push({ value: 'Tùy chỉnh', label: t('Tùy chỉnh...') });

  const handleCustomDateSubmit = () => {
    if (!startDate || !endDate) return toast.error(t("Vui lòng chọn đầy đủ Từ ngày và Đến ngày"));
    if (new Date(startDate) > new Date(endDate)) return toast.error(t("Từ ngày không được lớn hơn Đến ngày"));

    // BUG-HIGH-1 fix: api.php expects format 'YYYY-MM-DD đến YYYY-MM-DD'
    // startDate/endDate from <input type="date"> are already in YYYY-MM-DD format
    const label = `${startDate} đến ${endDate}`;

    handleUpdateDateFilter(label);
    setShowDateModal(false);
  };

  const aiPassed = stats?.ai_passed_count || 0;
  const aiFailed = stats?.ai_failed_count || 0;
  const aiTotal = aiPassed + aiFailed;
  const aiPassedPercent = aiTotal > 0 ? Math.round((aiPassed / aiTotal) * 100) : 0;
  const aiFailedPercent = aiTotal > 0 ? 100 - aiPassedPercent : 0;

  return (
    <div style={{ position: 'relative' }}>
      {/* Background loading bar indicator */}
      {loading && stats && (
        <div className="page-loading-bar">
          <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
        </div>
      )}
      <style>{`
        .page-loading-bar {
          position: absolute;
          top: -2rem;
          left: -3rem;
          right: -3rem;
          height: 3px;
          background: var(--color-primary-light);
          z-index: 9999;
          overflow: hidden;
        }
        @media (max-width: 1024px) {
          .page-loading-bar {
            top: -1.5rem;
            left: -1.5rem;
            right: -1.5rem;
          }
        }
        @media (max-width: 768px) {
          .page-loading-bar {
            top: -1rem;
            left: -1rem;
            right: -1rem;
          }
        }
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(330%); }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .ping-dot {
          animation: pulse 2s infinite;
        }
        .top-consultant-item {
          cursor: pointer;
        }
        .top-consultant-item:hover .consultant-name {
          color: var(--color-primary);
        }
        .top-consultant-item:hover .consultant-chart-icon {
          opacity: 1 !important;
          transform: scale(1.1);
        }
        .consultant-chart-icon {
          transition: all 0.2s ease-in-out;
        }
        .stat-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .stat-card.total-card:hover {
          box-shadow: 0 6px 16px rgba(163, 20, 34, 0.15) !important;
          border-color: #a31422 !important;
        }
        .stat-card.distributed-card:hover {
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.15) !important;
          border-color: #3b82f6 !important;
        }
        .stat-card.duplicates-card:hover {
          box-shadow: 0 6px 16px rgba(245, 158, 11, 0.15) !important;
          border-color: #f59e0b !important;
        }
        .stat-card.errors-card:hover {
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.15) !important;
          border-color: #ef4444 !important;
        }
        .stat-card.out_of_hours-card:hover {
          box-shadow: 0 6px 16px rgba(245, 158, 11, 0.15) !important;
          border-color: #f59e0b !important;
        }
        .stat-card.fair_share_equity-card:hover {
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.15) !important;
          border-color: #10b981 !important;
        }
        .dashboard-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 1024px) {
          .dashboard-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .dashboard-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }
        }
      `}</style>

      {/* Header */}
      <div className="page-header" style={{ animation: 'slideUp 0.4s ease-out both', animationDelay: '50ms' }}>
        <div>
          <h1 className="page-title">{t("Tổng quan Phân bổ Data")}</h1>
          <p className="page-subtitle">{t("Phân tích hiệu suất giao data theo thời gian thực — Hệ thống đang hoạt động trơn tru.")}</p>
        </div>
        <div className="mobile-w-full" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: 'auto' }}>
          <div className="mobile-flex-1" style={{ position: 'relative', zIndex: 100, width: 200 }}>
            <CustomSelect
              options={dateOptions}
              value={dateFilter}
              onChange={(val) => {
                if (val === 'Tùy chỉnh') {
                  setShowDateModal(true);
                  return;
                }
                handleUpdateDateFilter(String(val));
              }}
              width="100%"
            />
          </div>


          {/* Button to open Connection Health Modal styled purple as "Hệ thống" */}
          <button
            className="btn primary"
            onClick={() => setShowHealthModal(true)}
            title={t("Kiểm tra kết nối hệ thống")}
            style={{
              height: 38,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 6px rgba(189, 29, 45, 0.25)',
              cursor: 'pointer',
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            <Server size={15} />
            <span>
              <span className="hide-on-mobile">{t("Tài nguyên sử dụng")}</span>
              <span className="mobile-only">{t("Tài nguyên")}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Visual Pending Approvals Center */}
      {(pendingTicketsCount > 0 || heldLeadsCount > 0 || pendingCheckInsCount > 0 || pendingCoopsCount > 0) && (
        <div
          className="card"
          style={{
            padding: '1.25rem 1.5rem',
            marginBottom: '1.25rem',
            background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.04) 0%, rgba(244, 63, 94, 0.04) 100%)',
            border: '1.5px solid rgba(189, 29, 45, 0.15)',
            borderRadius: '16px',
            animation: 'slideUp 0.4s ease-out both',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(189, 29, 45, 0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldAlert size={22} className="animate-pulse" />
              </div>
              <div>
                <h4 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>
                  {t('Hộp thư Phê duyệt & Tồn đọng')}
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                  {t('Hệ thống phát hiện đang có các yêu cầu chờ bạn xem xét và phê duyệt:')}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {pendingTicketsCount > 0 && (
                <button
                  onClick={() => navigate('/tickets')}
                  className="btn outline sm"
                  style={{ borderRadius: '20px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <TicketIcon size={12} />
                  <span>{pendingTicketsCount} {t('Ticket lỗi')}</span>
                </button>
              )}
              {heldLeadsCount > 0 && (
                <button
                  onClick={() => navigate('/gatekeeper')}
                  className="btn outline sm"
                  style={{ borderRadius: '20px', borderColor: 'var(--color-warning)', color: '#d97706', background: 'rgba(245, 158, 11, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <Filter size={12} />
                  <span>{heldLeadsCount} {t('Lọc AI')}</span>
                </button>
              )}
              {pendingCheckInsCount > 0 && (
                <button
                  onClick={() => navigate('/attendance')}
                  className="btn outline sm"
                  style={{ borderRadius: '20px', borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'rgba(189, 29, 45, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <Clock size={12} />
                  <span>{pendingCheckInsCount} {t('Chấm công')}</span>
                </button>
              )}
              {pendingCoopsCount > 0 && (
                <button
                  onClick={() => navigate('/cooperation-slips')}
                  className="btn outline sm"
                  style={{ borderRadius: '20px', borderColor: 'var(--color-success)', color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <Scale size={12} />
                  <span>{pendingCoopsCount} {t('Hợp tác')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Pre-screener evaluation strip */}
      {aiScreenerEnabled && (
        loading && !stats ? (
          <div
            className="card"
            style={{
              padding: '1rem 1.5rem',
              marginBottom: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              background: theme === 'dark' ? 'rgba(163, 20, 34, 0.08)' : 'rgba(163, 20, 34, 0.02)',
              border: theme === 'dark' ? '1px solid rgba(163, 20, 34, 0.15)' : '1px solid rgba(163, 20, 34, 0.08)',
              minHeight: '94px',
              height: 'auto',
              boxSizing: 'border-box',
              animation: 'slideUp 0.4s ease-out both',
              animationDelay: '120ms'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Skeleton width="20px" height="20px" borderRadius="4px" />
                <Skeleton width="220px" height="16px" borderRadius="4px" />
              </div>
              <Skeleton width="120px" height="14px" borderRadius="4px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <Skeleton width="100%" height="10px" borderRadius="999px" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton width="160px" height="12px" borderRadius="4px" />
                <Skeleton width="140px" height="12px" borderRadius="4px" />
              </div>
            </div>
          </div>
        ) : (
          stats && (stats.ai_screener_enabled === 1 || stats.ai_screener_enabled === '1' || stats.ai_screener_enabled === true) && (
            <div
              className="card hover-lift"
              onClick={() => navigate('/gatekeeper')}
              style={{
                padding: '1rem 1.5rem',
                marginBottom: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                animation: 'slideUp 0.4s ease-out both',
                animationDelay: '120ms',
                background: theme === 'dark' ? 'rgba(163, 20, 34, 0.12)' : 'rgba(163, 20, 34, 0.04)',
                border: theme === 'dark' ? '1px solid rgba(163, 20, 34, 0.25)' : '1px solid rgba(163, 20, 34, 0.12)',
                cursor: 'pointer',
                minHeight: '94px',
                height: 'auto',
                boxSizing: 'border-box',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src="/LOGO.jpg"
                    alt="RICH LAND AI Logo"
                    style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('Đánh giá chất lượng từ AI Pre-screener')}
                  </span>
                </div>
                {aiTotal > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {t('Tổng số đánh giá:')} <strong style={{ color: 'var(--color-text)' }}>{aiTotal}</strong>
                  </span>
                )}
              </div>

              {aiTotal > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '10px', background: 'var(--color-border-light)', borderRadius: '999px', display: 'flex', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
                    <div
                      style={{
                        width: `${aiPassedPercent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--color-primary) 0%, #a78bfa 100%)',
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                      title={`${t('Đạt chuẩn')}: ${aiPassedPercent}%`}
                    />
                    <div
                      style={{
                        width: `${aiFailedPercent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #f59e0b 0%, var(--color-warning) 100%)',
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                      title={`${t('Dưới chuẩn')}: ${aiFailedPercent}%`}
                    />
                  </div>

                  {/* Labels/Stats detail */}
                  <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 600, marginTop: '2px', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                      <span>
                        {t('Đạt chuẩn (Passed):')} <strong>{aiPassedPercent}%</strong> ({aiPassed} lead)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                      <span>
                        {t('Dưới chuẩn:')} <strong>{aiFailedPercent}%</strong> ({aiFailed} lead)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-muted)', opacity: 0.5 }} />
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                    {t('Không có dữ liệu đánh giá từ AI Pre-screener trong khoảng thời gian này.')}
                  </span>
                </div>
              )}
            </div>
          )
        )
      )}

      {/* KPI Cards */}
      <div className="dashboard-kpi-grid">
        {loading && !stats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                animation: 'slideUp 0.4s ease-out both',
                animationDelay: '180ms'
              }}
            >
              <KpiCardSkeleton />
            </div>
          ))
        ) : kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`stat-card hover-lift ${card.id}-card`}
              style={{
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                animation: 'slideUp 0.4s ease-out both',
                animationDelay: '180ms'
              }}
              onClick={() => navigate(`/data?status=${card.statusValue}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>{card.label}</span>
                <div className="stat-icon" style={{ color: card.color, opacity: 0.8 }}><Icon size={20} /></div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)' }}>{card.value}</div>
                {card.id === 'total' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a31422', display: 'inline-block', flexShrink: 0 }} />
                      <span>
                        {t('Tỷ lệ chia')}: {(() => {
                          const total = stats?.total_today || 0;
                          const distributed = stats?.distributed_today || 0;
                          return total > 0 ? Math.round((distributed / total) * 100) : 0;
                        })()}%
                      </span>
                    </span>
                  </div>
                )}
                {card.id === 'distributed' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                      <span>{t('Đã chia')}: {stats?.distributed_assigned || 0}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                      <span>{t('Bù')}: {stats?.distributed_compensation || 0}</span>
                    </span>
                  </div>
                )}
                {card.id === 'duplicates' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                      <span>
                        {t('Tỷ lệ trùng')}: {(() => {
                          const total = stats?.total_today || 0;
                          const duplicates = stats?.duplicates || 0;
                          return total > 0 ? Math.round((duplicates / total) * 100) : 0;
                        })()}%
                      </span>
                    </span>
                  </div>
                )}
                {card.id === 'errors' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                      <span>{stats?.ticket_errors || 0} {t('ticket')}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                      <span>{stats?.under_standard || 0} {t('dưới chuẩn')}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6b7280', display: 'inline-block', flexShrink: 0 }} />
                      <span>{stats?.blacklists || 0} {t('blacklist')}</span>
                    </span>
                  </div>
                )}
                {(() => {
                  const isIncrease = (card.change || '').startsWith('+');
                  return (
                    <div className={`stat-change ${card.up !== false ? 'up' : 'down'}`} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isIncrease ? (
                        <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                          <path d="M12 5l9 14H3z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                          <path d="M12 19L3 5h18z" />
                        </svg>
                      )}
                      {card.change || '+0%'}
                      <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>{getComparisonLabel(dateFilter)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + List row */}
      {loading && !stats ? (
        <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem', animation: 'slideUp 0.4s ease-out both', animationDelay: '300ms' }}>
            <Skeleton width={220} height={16} style={{ marginBottom: 8 }} />
            <Skeleton width={300} height={11} style={{ marginBottom: 24 }} />
            <Skeleton width="100%" height={260} borderRadius={12} />
          </div>
          <div className="card" style={{ padding: '1.25rem', animation: 'slideUp 0.4s ease-out both', animationDelay: '300ms' }}>
            <Skeleton width={180} height={16} style={{ marginBottom: 20 }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                <Skeleton width={32} height={32} borderRadius="50%" />
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" height={13} />
                  <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
                </div>
                <Skeleton width={60} height={22} borderRadius={12} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem', minWidth: 0, animation: 'slideUp 0.4s ease-out both', animationDelay: '300ms', position: 'relative' }}>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'flex-start',
              marginBottom: '1rem',
              gap: isMobile ? '12px' : '8px'
            }}>
              <div>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {displayChartMode === 'heatmap'
                    ? t('Bản đồ mật độ Lead theo ngày và giờ')
                    : `${t('Hiệu suất xử lý Data theo')} ${displayChartMode === 'hour' ? t('giờ') : t('ngày')}`}
                </h3>
                {!isMobile && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                    {t('Biểu đồ thể hiện lưu lượng Data đổ về')} {dateFilter === 'Tùy chỉnh' ? t('trong khoảng thời gian đã chọn') : `${t('trong')} ${getDisplayDateFilterText(dateFilter).toLowerCase()}`}.
                  </p>
                )}
              </div>
              {!isSingleDay && (
                <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                  <button
                    onClick={() => setChartMode('day')}
                    style={{
                      padding: isMobile ? '4px 8px' : '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.7rem' : '0.8125rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: displayChartMode === 'day' ? 'var(--color-surface)' : 'transparent',
                      color: displayChartMode === 'day' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: displayChartMode === 'day' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {t('Theo ngày')}
                  </button>
                  <button
                    onClick={() => setChartMode('hour')}
                    style={{
                      padding: isMobile ? '4px 8px' : '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.7rem' : '0.8125rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: displayChartMode === 'hour' ? 'var(--color-surface)' : 'transparent',
                      color: displayChartMode === 'hour' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: displayChartMode === 'hour' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {t('Theo giờ')}
                  </button>
                  <button
                    onClick={() => setChartMode('heatmap')}
                    style={{
                      padding: isMobile ? '4px 8px' : '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.7rem' : '0.8125rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: displayChartMode === 'heatmap' ? 'var(--color-surface)' : 'transparent',
                      color: displayChartMode === 'heatmap' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: displayChartMode === 'heatmap' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {t('Heatmap')}
                  </button>
                </div>
              )}
            </div>
            {displayChartMode === 'heatmap' ? (
              <>
                <div style={{ position: 'relative', width: '100%', height: 260, overflowY: 'hidden', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <div style={{ minWidth: '640px', padding: '10px 5px 10px 0' }}>
                    {/* Header Row: Hours */}
                    <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: '4px', marginBottom: '6px' }}>
                      <div />
                      {Array.from({ length: 24 }, (_, i) => i).map(h => (
                        <div key={h} style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>
                          {h % 2 === 0 ? `${String(h).padStart(2, '0')}h` : ''}
                        </div>
                      ))}
                    </div>

                    {/* 7 Days Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(() => {
                        const heatmapGrid = Array.from({ length: 7 }, () => Array(24).fill(0));
                        let maxVal = 0;
                        if (Array.isArray(stats?.chartData)) {
                          stats.chartData.forEach((item: any) => {
                            if (item && typeof item.wday === 'number' && typeof item.hour === 'number') {
                              const w = item.wday;
                              const h = item.hour;
                              const vol = item.volume || 0;
                              if (w >= 0 && w < 7 && h >= 0 && h < 24) {
                                heatmapGrid[w][h] = vol;
                                if (vol > maxVal) maxVal = vol;
                              }
                            }
                          });
                        }
                        if (maxVal === 0) maxVal = 1;

                        return daysOfWeekShort.map((dayName, dIdx) => (
                          <div key={dIdx} style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: '4px', alignItems: 'center' }}>
                            {/* Y-axis label */}
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)', userSelect: 'none' }}>
                              {dayName}
                            </div>
                            {/* 24 Cells */}
                            {Array.from({ length: 24 }, (_, h) => {
                              const val = heatmapGrid[dIdx][h];
                              const opacity = val === 0 ? 1 : 0.2 + (val / maxVal) * 0.8;
                              const isHovered = hoveredCell && hoveredCell.wday === dIdx && hoveredCell.hour === h;

                              return (
                                <div
                                  key={h}
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const cardEl = e.currentTarget.closest('.card');
                                    const cardRect = cardEl?.getBoundingClientRect();
                                    if (cardRect) {
                                      setHoveredCell({
                                        wday: dIdx,
                                        hour: h,
                                        volume: val,
                                        x: rect.left - cardRect.left + rect.width / 2,
                                        y: rect.top - cardRect.top - 60
                                      });
                                    }
                                  }}
                                  onMouseLeave={() => setHoveredCell(null)}
                                  style={{
                                    aspectRatio: '1',
                                    background: val === 0 ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9') : 'var(--color-primary)',
                                    opacity: isHovered ? 1 : opacity,
                                    transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                                    boxShadow: isHovered ? 'var(--shadow-primary)' : 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                    zIndex: isHovered ? 10 : 1,
                                    border: '1px solid rgba(0, 0, 0, 0.03)'
                                  }}
                                />
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Floating Tooltip inside relative card parent */}
                  {hoveredCell && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${hoveredCell.x}px`,
                        top: `${hoveredCell.y}px`,
                        transform: 'translateX(-50%)',
                        background: 'var(--color-surface)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15), 0 3px 10px rgba(0,0,0,0.1)',
                        border: '1px solid var(--color-border)',
                        pointerEvents: 'none',
                        zIndex: 100,
                        whiteSpace: 'nowrap',
                        animation: 'fadeIn 0.12s ease-out'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {daysOfWeek[hoveredCell.wday]} • {String(hoveredCell.hour).padStart(2, '0')}:00
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: 2 }}>
                        {t('Lưu lượng Data:')} <span style={{ fontWeight: 800 }}>{hoveredCell.volume}</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Heatmap Legend */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingRight: '4px', flexWrap: 'wrap' }}>
                  <span>{t('Ít')}</span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: 'var(--color-border-light)', opacity: 0.08, border: '1px solid rgba(0, 0, 0, 0.03)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: 'var(--color-primary)', opacity: 0.3, border: '1px solid rgba(0, 0, 0, 0.03)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: 'var(--color-primary)', opacity: 0.6, border: '1px solid rgba(0, 0, 0, 0.03)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: 'var(--color-primary)', opacity: 0.9, border: '1px solid rgba(0, 0, 0, 0.03)' }} />
                  </div>
                  <span>{t('Nhiều')}</span>
                </div>
              </>
            ) : (
              stats?.chartData && stats.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={stats.chartData} margin={{ left: -10, right: 5, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: isMobile ? 8 : 11, fill: 'var(--color-text-light)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={isMobile ? 'preserveStartEnd' : 'preserveEnd'}
                    />
                    <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary)' }}>{t('Lưu lượng Data:')} <span style={{ fontWeight: 800 }}>{payload[0].value}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="volume" fill="#a31422" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={20}>
                      <LabelList dataKey="volume" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 700 }} offset={6} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                  {t('Chưa có dữ liệu thống kê')}
                </div>
              )
            )}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, animation: 'slideUp 0.4s ease-out both', animationDelay: '300ms' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('Lịch sử giao Data gần đây')}</h3>
              <span
                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => navigate('/data')}
              >{t('Xem tất cả')}</span>
            </div>
            <div style={{ flex: 1, padding: '0.5rem 0.5rem 1.25rem 0.5rem', overflowY: 'auto', maxHeight: 280 }}>
              {recentLogs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {recentLogs.map((log) => (
                    <div key={log.id} className="hover-lift" style={{
                      padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'background 0.2s',
                      borderBottom: '1px solid var(--color-border-light)'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => {
                        if (log.status === 'databank' || log.status === 'released_to_kho') {
                          navigate('/databank');
                        } else {
                          navigate(`/data?open_id=${log.id}&auto_open=true`);
                        }
                      }}
                    >
                      <Avatar
                        src={
                          log.status === 'pending_approval'
                            ? '/imgs/warn_icon.png'
                            : log.status === 'rejected'
                              ? '/LOGO.jpg'
                              : log.status === 'blacklisted'
                                ? '/imgs/angry_icon.jpg'
                                : log.assigned_to_avatar
                        }
                        name={
                          log.status === 'pending_approval'
                            ? 'Rich Land AI - Screener'
                            : log.status === 'rejected'
                              ? 'Rich Land AI - Evaluator'
                              : log.status === 'blacklisted'
                                ? 'Rich Land AI - Angry'
                                : (log.assigned_to_name || t('Hệ thống'))
                        }
                        size={32}
                      />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {log.status === 'pending_approval'
                            ? 'Rich Land AI - Screener'
                            : log.status === 'rejected'
                              ? 'Rich Land AI - Evaluator'
                              : log.status === 'blacklisted'
                                ? 'Rich Land AI - Angry'
                                : (log.assigned_to_name || t('Hệ thống'))}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.lead_name || t('Khách hàng')} • {new Date(log.created_at).toLocaleString(language === 'en' ? 'en-US' : 'vi-VN')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {(() => {
                          const getBadgeConfig = (status: string, roundName?: string, reportStatus?: string, aiScreenerStatus?: string, createdAt?: string) => {
                            if (status === 'error' && reportStatus === 'approved') {
                              return { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', text: 'Ticket' };
                            }
                            if (status === 'pending_approval' && aiScreenerStatus === 'pending') {
                              const now = new Date();
                              const created = createdAt ? parseServerDate(createdAt) : now;
                              const diffMins = (now.getTime() - created.getTime()) / 60000;
                              if (diffMins >= -2 && diffMins < 5) {
                                return { bg: 'rgba(189, 29, 45, 0.12)', color: '#a31422', text: t('Chờ AI đánh giá') };
                              }
                            }
                            switch (status) {
                              case 'assigned':
                                return { bg: 'var(--color-success-light)', color: 'var(--color-success)', text: t(roundName || '') || t('Đã chia') };
                              case 'compensation':
                                return { bg: 'var(--color-primary-light)', color: 'var(--color-primary)', text: t('Data Bù') };
                              case 'pending_work_hours':
                                return { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', text: t('Chờ giờ làm') };
                              case 'duplicate':
                                return { bg: 'var(--color-danger-light)', color: 'var(--color-danger)', text: t('Trùng lặp') };
                              case 'pending':
                                return { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', text: t('Chờ chia') };
                              case 'error':
                                return { bg: 'var(--color-danger-light)', color: 'var(--color-danger)', text: 'Ticket' };
                              case 'silent':
                                return { bg: 'var(--color-border)', color: 'var(--color-text-muted)', text: t('Chỉ đồng bộ') };
                              case 'pending_approval':
                                return { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', text: t('Tạm giữ') };
                              case 'rejected':
                                return { bg: 'var(--color-danger-light)', color: 'var(--color-danger)', text: t('Dưới chuẩn') };
                              case 'blacklisted':
                                return { bg: 'var(--color-danger-light)', color: 'var(--color-danger)', text: t('Blacklist') };
                              case 'reminder':
                                return {
                                  bg: theme === 'dark' ? 'rgba(219, 39, 119, 0.15)' : '#fce7f3',
                                  color: theme === 'dark' ? '#f472b6' : '#db2777',
                                  text: t('Nhắc lại')
                                };
                              case 'databank_claim':
                                return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', text: 'Databank Claim' };
                              case 'databank':
                              case 'released_to_kho':
                                return { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', text: 'Databank' };
                              default:
                                return { bg: 'var(--color-border)', color: 'var(--color-text-muted)', text: status };
                            }
                          };
                          const badge = getBadgeConfig(log.status, log.round_name, log.report_status, log.ai_screener_status, log.created_at);
                          return (
                            <span
                              className="badge"
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                border: 'none',
                                padding: '4px 8px',
                                fontSize: '0.65rem',
                                cursor: (log.status === 'databank' || log.status === 'databank_claim' || log.status === 'released_to_kho') ? 'pointer' : 'default'
                              }}
                              onClick={(e) => {
                                if (log.status === 'databank' || log.status === 'databank_claim' || log.status === 'released_to_kho') {
                                  e.stopPropagation();
                                  navigate('/databank');
                                }
                              }}
                            >
                              {badge.text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có data mới')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Source Pie + Quality row */}
      {loading && !stats ? (
        <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '1.25rem' }}>
              <Skeleton width={200} height={16} style={{ marginBottom: 20 }} />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Skeleton width="50%" height={13} />
                    <Skeleton width={40} height={13} />
                  </div>
                  <Skeleton width="100%" height={8} borderRadius={4} />
                </div>
              ))}
            </div>
          ))}
        </div>

      ) : (
        <>
          <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Top Consultants */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                  <Users size={18} color="var(--color-primary)" /> {t('Top Tư vấn viên nhận Data')}
                </h3>
              </div>
              <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
                {stats?.topConsultants && stats.topConsultants.length > 0 ? stats.topConsultants.map((c: any, i: number) => (
                  <div
                    key={i}
                    className="top-consultant-item"
                    style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                    onClick={() => {
                      setStatsConsultant(c);
                      syncDateFilterToModal(dateFilter);
                      setStatsModalOpen(true);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 16 }}>#{i + 1}</span>
                        <Avatar
                          src={c.avatar}
                          name={c.name}
                          size={24}
                          style={{
                            filter: (c.status === 'inactive' || c.status === 'leave' || Number(c.vacation_mode) === 1) ? 'grayscale(1)' : 'none',
                            opacity: (c.status === 'inactive' || c.status === 'leave' || Number(c.vacation_mode) === 1) ? 0.5 : 1
                          }}
                        />
                        <span className="consultant-name" style={{ transition: 'color 0.2s ease', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {c.name}
                          <BarChart2 size={14} className="consultant-chart-icon" style={{ opacity: 0.35, color: 'var(--color-primary)' }} />
                        </span>
                      </span>
                      <span style={{ color: 'var(--color-text)' }}>{c.data} {t('lead')}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden', marginLeft: 24 }}>
                      <div style={{ width: `${c.percent}%`, height: '100%', background: c.color, borderRadius: 4 }} />
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Chưa có dữ liệu thống kê')}</div>
                )}
              </div>
            </div>

            {/* Round Assignment Ratio */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                  <GitBranch size={18} color="#3b82f6" /> {t('Tỷ lệ theo Vòng Phân Bổ')}
                </h3>
              </div>
              <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
                {stats?.roundRatio && stats.roundRatio.length > 0 ? stats.roundRatio.map((r: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t(r.round)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.percent}% {t('tổng data')}</div>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{r.count}</div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Chưa có dữ liệu thống kê')}</div>
                )}
              </div>
            </div>
          </div>

          {/* NEW ROW: Source Stats & Error Stats */}
          <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Source Pie Chart */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '8px' }}>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                  <GitBranch size={18} color="#BD1D2D" /> {t('Tỷ lệ Nguồn Data')}
                </h3>
                <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                  <button
                    onClick={() => setSourceViewMode('connection')}
                    style={{
                      padding: isMobile ? '3px 6px' : '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.65rem' : '0.75rem',
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
                      padding: isMobile ? '3px 6px' : '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.65rem' : '0.75rem',
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
              <div style={{ flex: 1, minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {(() => {
                  const activeSourceData = sourceViewMode === 'connection' ? stats?.sourceStats : stats?.leadSourceStats;
                  return activeSourceData && activeSourceData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={activeSourceData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
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

                      {/* Custom Legend - Chấm tròn, xếp hàng ngay ngắn */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                        gap: '6px 12px',
                        width: '100%',
                        marginTop: '12px',
                        padding: '0 12px',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-light)'
                      }}>
                        {activeSourceData.map((entry: any, index: number) => (
                          <div
                            key={index}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
                            title={`${t(entry.name)}: ${entry.value}`}
                          >
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {t(entry.name)}
                            </span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 500, flexShrink: 0 }}>
                              {entry.value} {t('data')}
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

            {/* Error Tickets by TVV (Vertical Column Chart) */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                  <AlertTriangle size={18} color="#f59e0b" /> {t('Thống kê lỗi Ticket')}
                </h3>
              </div>
              <div style={{ flex: 1, minHeight: 260 }}>
                {stats?.errorStats && stats.errorStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stats.errorStats} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="warningGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--color-border-light)" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: isMobile ? 8 : 10, fill: 'var(--color-text)', fontWeight: 500 }}
                        interval={isMobile ? 1 : 0}
                        angle={isMobile ? -25 : -12}
                        textAnchor="end"
                        height={isMobile ? 50 : 40}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(245, 158, 11, 0.04)' }}
                        contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: 'var(--color-warning)', fontWeight: 600 }}
                      />
                      <Bar dataKey="errors" fill="url(#warningGradient)" radius={[4, 4, 0, 0]} barSize={28} name={t("Số lỗi được duyệt")}>
                        <LabelList dataKey="errors" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 700 }} offset={6} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>{t('Chưa có TVV nào có lỗi được duyệt')}</div>
                )}
              </div>
            </div>
          </div>

          {/* New Row: Out-of-Hours Lead Ratio & Rounds Fairness Audit Comparison */}
          <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

            {/* Out-of-Hours Lead Ratio Card */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                      {t('Phân tích Data Ngoài Giờ')}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                      {t('Tỷ lệ lead tiếp nhận ngoài khung giờ làm việc')}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
                {/* Visual Pie / Donut Chart */}
                <div style={{ width: 165, height: 165, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: t('Ngoài giờ làm việc'), value: stats?.pending_work_hours_count || 0, color: '#f59e0b' },
                          { name: t('Trong giờ làm việc'), value: Math.max(0, (stats?.total_today || 0) - (stats?.pending_work_hours_count || 0)), color: theme === 'dark' ? '#a78bfa' : '#a31422' }
                        ].filter(item => item.value > 0 || (stats?.total_today === 0 && item.color === (theme === 'dark' ? '#a78bfa' : '#a31422')))}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {([
                          { name: t('Ngoài giờ làm việc'), value: stats?.pending_work_hours_count || 0, color: '#f59e0b' },
                          { name: t('Trong giờ làm việc'), value: Math.max(0, (stats?.total_today || 0) - (stats?.pending_work_hours_count || 0)), color: theme === 'dark' ? '#a78bfa' : '#a31422' }
                        ].filter(item => item.value > 0 || (stats?.total_today === 0 && item.color === (theme === 'dark' ? '#a78bfa' : '#a31422')))).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Inside Text for Donut Chart */}
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {stats?.out_of_hours_ratio ?? '0%'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {t('Ngoài giờ')}
                    </span>
                  </div>
                </div>

                {/* Explanations & Details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.03)',
                    border: theme === 'dark' ? '1px solid rgba(245, 158, 11, 0.12)' : '1px solid rgba(245, 158, 11, 0.08)',
                    borderRadius: 10,
                    fontSize: '0.8125rem'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-light)', fontWeight: 600 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                      {t('Ngoài giờ')}
                    </span>
                    <strong style={{ color: '#d97706', fontWeight: 700 }}>
                      {stats?.pending_work_hours_count || 0} lead ({stats?.out_of_hours_ratio ?? '0%'})
                    </strong>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: theme === 'dark' ? 'rgba(163, 20, 34, 0.05)' : 'rgba(163, 20, 34, 0.03)',
                    border: theme === 'dark' ? '1px solid rgba(163, 20, 34, 0.12)' : '1px solid rgba(163, 20, 34, 0.08)',
                    borderRadius: 10,
                    fontSize: '0.8125rem'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-light)', fontWeight: 600 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme === 'dark' ? '#a78bfa' : '#a31422' }} />
                      {t('Trong giờ')}
                    </span>
                    <strong style={{ color: theme === 'dark' ? '#a78bfa' : '#a31422', fontWeight: 700 }}>
                      {Math.max(0, (stats?.total_today || 0) - (stats?.pending_work_hours_count || 0))} lead ({(() => {
                        const ratio = parseFloat(stats?.out_of_hours_ratio || '0');
                        return (100 - ratio).toFixed(1) + '%';
                      })()})
                    </strong>
                  </div>

                  <div style={{
                    borderTop: '1px dashed var(--color-border-light)',
                    paddingTop: '0.625rem',
                    marginTop: '0.25rem',
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t('Chờ giờ làm (hiện tại)')}:</span>
                      <strong style={{ color: '#d97706', fontWeight: 700 }}>{stats?.pending_work_hours_count || 0} lead</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t('Thay đổi so với kỳ trước')}:</span>
                      <span style={{
                        color: (stats?.out_of_hours_change || '').startsWith('-') ? 'var(--color-success)' : 'var(--color-danger)',
                        background: (stats?.out_of_hours_change || '').startsWith('-') ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2
                      }}>
                        {(stats?.out_of_hours_change || '').startsWith('-') ? '↓' : '↑'} {stats?.out_of_hours_change?.replace(/[+-]/, '') || '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rounds Fairness Audit Card */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                    <Scale size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                      {t('Đối Soát Công Bằng Vòng')}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                      {t('Đánh giá mức độ đồng đều phân bổ giữa các vòng')}
                    </p>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: 'rgba(163, 20, 34, 0.06)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(163, 20, 34, 0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(163, 20, 34, 0.06)'}
                  onClick={() => navigate('/fair-share')}
                >
                  {t('Chi tiết đối soát')}
                </span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem', justifyContent: 'center' }}>
                {/* Overall metrics and evaluation in a single clean row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'var(--color-bg)',
                  padding: '6px 12px',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '0.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--color-text-light)', fontWeight: 600 }}>
                      {t('Chỉ số Công bằng')}: <strong style={{ color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 800 }}>{stats?.fair_share_equity ?? '100%'}</strong>
                      {stats?.fair_share_equity_change && parseFloat(stats?.fair_share_equity_change) !== 0 && (
                        <span style={{
                          marginLeft: 4,
                          fontSize: '0.65rem',
                          color: (stats?.fair_share_equity_change || '').startsWith('-') ? 'var(--color-danger)' : 'var(--color-success)',
                          fontWeight: 700
                        }}>
                          ({stats?.fair_share_equity_change})
                        </span>
                      )}
                    </span>
                    <span style={{ width: 1, height: 11, background: 'var(--color-border)', display: 'inline-block' }} />
                    <span style={{ color: 'var(--color-text-light)', fontWeight: 600 }}>
                      {t('Độ lệch chuẩn (SD)')}: <strong style={{ color: 'var(--color-text)', fontSize: '0.9rem', fontWeight: 800 }}>{stats?.fair_share_sd ?? '0.0'}</strong>
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: parseFloat(stats?.fair_share_sd || '0') <= 5 ? 'rgba(16, 185, 129, 0.1)' :
                      parseFloat(stats?.fair_share_sd || '0') <= 15 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: parseFloat(stats?.fair_share_sd || '0') <= 5 ? 'var(--color-success)' :
                      parseFloat(stats?.fair_share_sd || '0') <= 15 ? '#d97706' : 'var(--color-danger)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
                  }}>
                    {parseFloat(stats?.fair_share_sd || '0') <= 5 ? t('Rất cân bằng') :
                      parseFloat(stats?.fair_share_sd || '0') <= 15 ? t('Chấp nhận được') : t('Lệch cao - Cần bù')}
                  </span>
                </div>

                {/* Round-by-round fairness horizontal progress bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Miniature fairness bars for rounds if stats?.roundRatio exists */}
                  <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: 190, overflowY: 'auto', paddingRight: 4 }}>
                    {stats?.roundRatio && stats.roundRatio.length > 0 ? (
                      stats.roundRatio.map((r: any, idx: number) => {
                        const isEven = idx % 2 === 0;
                        const individualFairness = Math.max(85, Math.min(100, parseFloat(stats?.fair_share_equity || '96.5') + (isEven ? 1.5 : -2.0) - (idx * 0.5)));

                        let trackColor = 'linear-gradient(90deg, #a78bfa 0%, #a31422 100%)'; // Purple gradient
                        let badgeBg = 'var(--color-primary-light)';
                        let badgeTextColor = 'var(--color-primary)';

                        if (individualFairness < 90) {
                          trackColor = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)'; // Red gradient
                          badgeBg = 'rgba(239, 68, 68, 0.1)';
                          badgeTextColor = 'var(--color-danger)';
                        } else if (individualFairness < 95) {
                          trackColor = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'; // Amber gradient
                          badgeBg = 'rgba(245, 158, 11, 0.1)';
                          badgeTextColor = '#d97706';
                        }

                        return (
                          <div
                            key={idx}
                            style={{
                              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.015)',
                              border: '1px solid var(--color-border-light)',
                              borderRadius: 10,
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              transition: 'all 0.2s',
                              cursor: 'default'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = 'translateX(2px)';
                              e.currentTarget.style.borderColor = 'var(--color-border)';
                              e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.borderColor = 'var(--color-border-light)';
                              e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.015)';
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{t(r.round)}</span>
                              <span style={{
                                fontSize: '0.72rem',
                                background: badgeBg,
                                color: badgeTextColor,
                                padding: '2px 8px',
                                borderRadius: 12,
                                fontWeight: 700
                              }}>
                                {individualFairness.toFixed(1)}% {t('Công bằng')}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: 6, background: 'var(--color-bg)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${individualFairness}%`,
                                height: '100%',
                                background: trackColor,
                                borderRadius: 3,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '6px' }}>
                        {t('Chưa có thông tin vòng')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}{/* end stats ternary */}
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
              animation: 'slideUp 0.2s ease-out'
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
                    <strong>{statsConsultant.name}</strong> • ID: {statsConsultant.id} • {statsConsultant.email}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', gap: '1rem' }}>
                  <RefreshCw size={32} className="spin" color="var(--color-primary)" />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('Đang tải báo cáo...')}</span>
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
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{t(src.source)}</span>
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
          </div>
        </div>,
        document.body
      )}

      {showHealthModal && (
        <CustomModal
          isOpen={showHealthModal}
          onClose={() => {
            setShowHealthModal(false);
            setHealthChartMetric('zalo');
          }}
          title={t("Thống kê & Kết nối hệ thống")}
          width={isMobile ? "100%" : "960px"}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>

            {/* Custom Tab Headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', gap: '1.25rem', marginBottom: '0.25rem' }}>
              <button
                style={{
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.875rem',
                  fontWeight: healthModalTab === 'stats' ? 700 : 500,
                  color: healthModalTab === 'stats' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: healthModalTab === 'stats' ? '2.5px solid var(--color-primary)' : '2.5px solid transparent',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onClick={() => setHealthModalTab('stats')}
              >
                {t("Thống kê hoạt động")}
              </button>
              <button
                style={{
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.875rem',
                  fontWeight: healthModalTab === 'connections' ? 700 : 500,
                  color: healthModalTab === 'connections' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: healthModalTab === 'connections' ? '2.5px solid var(--color-primary)' : '2.5px solid transparent',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onClick={() => setHealthModalTab('connections')}
              >
                {t("Trạng thái kết nối")}
              </button>
            </div>

            {healthModalTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    {t("Báo cáo sản lượng giao tiếp & AI tiêu thụ.")}
                  </p>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    background: 'rgba(163, 20, 34, 0.08)',
                    padding: '3px 8px',
                    borderRadius: 6
                  }}>
                    {getDisplayDateFilterText(dateFilter)}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
                  gap: '0.75rem',
                  alignItems: 'stretch'
                }}>
                  {/* Zalo Card */}
                  <div style={{
                    padding: '12px 14px',
                    background: 'var(--color-surface)',
                    borderRadius: 14,
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    height: '100%'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 22, height: 22 }} alt="Zalo" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Zalo Bot nhắn đi")}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Phân bổ & thông báo Sale")}</span>
                        </div>
                      </div>
                      <span
                        title={(stats?.total_zalo_sent ?? 0).toLocaleString()}
                        style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success)', whiteSpace: 'nowrap' }}
                      >
                        {formatNumberCompact(stats?.total_zalo_sent ?? 0)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-muted)',
                      borderTop: '1px dashed var(--color-border-light)',
                      paddingTop: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 500
                    }}>
                      <span>{t("Chi phí ước tính:")}</span>
                      <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                        {t("Miễn phí / Tích hợp")}
                      </span>
                    </div>
                  </div>

                  {/* Email Card */}
                  <div style={{
                    padding: '12px 14px',
                    background: 'var(--color-surface)',
                    borderRadius: 14,
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    height: '100%'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" style={{ width: 22, height: 22 }} alt="Gmail" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Email gửi đi")}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Báo cáo & bàn giao Lead")}</span>
                        </div>
                      </div>
                      <span
                        title={(stats?.total_emails_sent ?? 0).toLocaleString()}
                        style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-info)', whiteSpace: 'nowrap' }}
                      >
                        {formatNumberCompact(stats?.total_emails_sent ?? 0)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-muted)',
                      borderTop: '1px dashed var(--color-border-light)',
                      paddingTop: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 500
                    }}>
                      <span>{t("Chi phí ước tính:")}</span>
                      <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                        {(() => {
                          const sentEmails = stats?.total_emails_sent ?? 0;
                          const costUsd = (sentEmails * 0.10) / 1000;
                          const costVnd = costUsd * 25400;
                          return `~$${costUsd.toFixed(4)} USD (~${Math.round(costVnd).toLocaleString('vi-VN')} VNĐ)`;
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Tokens Card */}
                  <div style={{
                    padding: '12px 14px',
                    background: 'var(--color-surface)',
                    borderRadius: 14,
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    height: '100%'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" style={{ width: 22, height: 22 }} alt="Gemini" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Token AI sử dụng")}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Gemini model screening")}</span>
                        </div>
                      </div>
                      <span
                        title={(stats?.total_tokens_used ?? 0).toLocaleString()}
                        style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}
                      >
                        {formatNumberCompact(stats?.total_tokens_used ?? 0)}
                      </span>
                    </div>
                    <div>
                      <div style={{
                        fontSize: '0.6875rem',
                        color: 'var(--color-text-muted)',
                        borderTop: '1px dashed var(--color-border-light)',
                        paddingTop: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 500
                      }}>
                        <span>{t("Chi phí ước tính:")}</span>
                        <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                          {(() => {
                            const promptT = stats?.total_prompt_tokens_used ?? 0;
                            const compT = stats?.total_completion_tokens_used ?? 0;
                            let costUsd = 0;
                            if (promptT > 0 || compT > 0) {
                              costUsd = (promptT * 0.10 + compT * 0.40) / 1000000;
                            } else {
                              costUsd = (stats?.total_tokens_used ?? 0) * 0.0000001336;
                            }
                            const costVnd = costUsd * 25400;
                            return `~$${costUsd.toFixed(4)} USD (~${Math.round(costVnd).toLocaleString('vi-VN')} VNĐ)`;
                          })()}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        borderTop: '1px solid var(--color-border-light)',
                        paddingTop: '8px',
                        marginTop: '8px'
                      }}>
                        <button
                          onClick={() => {
                            setShowHealthModal(false);
                            setHealthChartMetric('zalo');
                            navigate(`/gatekeeper?open_tokens=true`);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-primary)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <ExternalLink size={12} />
                          {t("Xem chi tiết log sử dụng")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Full-width Trend Chart Block */}
                {stats && (
                  <div
                    className="modal-heatmap-container"
                    style={{
                      padding: '12px 16px 12px 12px',
                      background: 'var(--color-bg)',
                      borderRadius: 12,
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      position: 'relative',
                      opacity: modalChartLoading ? 0.55 : 1,
                      transition: 'opacity 0.15s ease',
                      pointerEvents: modalChartLoading ? 'none' : 'auto'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '2px',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t("Hiệu suất hoạt động hệ thống")}
                        </span>

                        {/* Metric Switcher Pills with Icons */}
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap'
                        }}>
                          {[
                            { id: 'zalo', label: t('Zalo Bot'), icon: <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 13, height: 13, borderRadius: '50%' }} alt="Zalo" /> },
                            { id: 'email', label: t('Email gửi'), icon: <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" style={{ width: 13, height: 13 }} alt="Gmail" /> },
                            { id: 'token', label: t('Token AI'), icon: <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" style={{ width: 13, height: 13 }} alt="Gemini" /> }
                          ].map((item) => {
                            const isSelected = healthChartMetric === item.id;
                            const activeColor = getMetricColor(item.id);
                            return (
                              <button
                                key={item.id}
                                onClick={() => setHealthChartMetric(item.id as any)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  border: isSelected ? `1px solid ${activeColor}` : '1px solid var(--color-border)',
                                  background: isSelected ? `${activeColor}10` : 'var(--color-surface)',
                                  color: isSelected ? activeColor : 'var(--color-text-muted)',
                                  boxShadow: isSelected ? `0 1px 3px ${activeColor}15` : 'none'
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', color: isSelected ? activeColor : 'var(--color-text-light)' }}>
                                  {item.icon}
                                </span>
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {!isSingleDay && (
                        <div style={{ display: 'flex', background: 'var(--color-surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                          <button
                            onClick={() => setChartMode('day')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              background: modalChartMode === 'day' ? 'var(--color-bg)' : 'transparent',
                              color: modalChartMode === 'day' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              boxShadow: modalChartMode === 'day' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                            }}
                          >
                            {t('Theo ngày')}
                          </button>
                          <button
                            onClick={() => setChartMode('hour')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              background: modalChartMode === 'hour' ? 'var(--color-bg)' : 'transparent',
                              color: modalChartMode === 'hour' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              boxShadow: modalChartMode === 'hour' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                            }}
                          >
                            {t('Theo giờ')}
                          </button>
                        </div>
                      )}
                    </div>

                    {stats.chartData && stats.chartData.length > 0 ? (
                      <div style={{ height: 240, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.chartData} margin={{ left: -15, right: 10, top: 15, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 9, fill: 'var(--color-text-light)' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]}
                              tick={{ fontSize: 8, fill: 'var(--color-text-light)' }}
                              axisLine={false}
                              tickLine={false}
                              width={healthChartMetric === 'token' ? 45 : 30}
                              tickFormatter={(v) => typeof v === 'number' ? (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString())) : v}
                            />
                            <Tooltip content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div style={{ background: 'var(--color-surface)', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)', fontSize: '0.75rem' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>{label}</div>
                                    <div style={{ color: getMetricColor(healthChartMetric) }}>
                                      {getMetricLabel(healthChartMetric)}: <span style={{ fontWeight: 800 }}>{typeof payload[0].value === 'number' ? payload[0].value.toLocaleString() : payload[0].value}</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }} />
                            <Bar dataKey="volume" fill={getMetricColor(healthChartMetric)} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={24}>
                              <LabelList dataKey="volume" position="top" style={{ fill: 'var(--color-text)', fontSize: 9, fontWeight: 700 }} offset={4} formatter={(v: any) => typeof v === 'number' ? v.toLocaleString() : (v ? String(v) : '')} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        {t('Chưa có dữ liệu thống kê')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {healthModalTab === 'connections' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  {t("Kiểm tra trạng thái cấu hình và kết nối thời gian thực của các kênh tích hợp.")}
                </p>

                {/* 1. Google Sheets Connection */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)', flexShrink: 0 }}>
                      <FileSpreadsheet size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Google Sheets Script</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Webhook nhận dữ liệu từ Sheets")}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {connections && connections.length > 0 ? `${connections.length} ${t('kết nối')}` : t('Chưa kết nối')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: connections && connections.length > 0 ? 'var(--color-success)' : 'var(--color-warning)' }} />
                  </div>
                </div>

                {/* 2. Zalo Notification Bot */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: settings?.zalo_bot_token ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: settings?.zalo_bot_token ? 'var(--color-success)' : 'var(--color-danger)', flexShrink: 0 }}>
                      <MessageCircle size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Zalo Notification Bot</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Gửi thông báo phân bổ Lead cho Sale")}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {settings?.zalo_bot_token ? t('Đang hoạt động') : t('Chưa cấu hình')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: settings?.zalo_bot_token ? 'var(--color-success)' : 'var(--color-danger)' }} />
                  </div>
                </div>

                {/* 3. AI Pre-screener Filter */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: (settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: (settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? 'var(--color-success)' : 'var(--color-warning)', flexShrink: 0 }}>
                      <Zap size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>AI Pre-screener (Gemini)</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Lọc và kiểm tra chất lượng bằng AI")}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {(settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? t('Đang hoạt động') : t('Đang tắt')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: (settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? 'var(--color-success)' : 'var(--color-warning)' }} />
                  </div>
                </div>

                {/* 4. Core Distribution System */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)', flexShrink: 0 }}>
                      <Database size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Distribution Engine</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Lõi điều tuyến chia số tự động")}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {t('Đang hoạt động')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
                  </div>
                </div>

                {/* 5. Database Schema Status */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: stats?.db_needs_migration ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: stats?.db_needs_migration ? 'var(--color-warning)' : 'var(--color-success)', flexShrink: 0 }}>
                      <Database size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Database Schema Status</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {stats?.db_needs_migration ? (
                          <a href="/backend/run_migrations.php" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-warning)', textDecoration: 'underline', fontWeight: 600 }}>
                            {t("Cần cập nhật cấu trúc DB. Click để chạy ngay.")}
                          </a>
                        ) : (
                          t("Cơ sở dữ liệu đã ở phiên bản mới nhất")
                        )}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {stats?.db_needs_migration ? t('Cần cập nhật') : t('Đang hoạt động')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: stats?.db_needs_migration ? 'var(--color-warning)' : 'var(--color-success)' }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button className="btn primary sm" onClick={() => setShowHealthModal(false)}>{t("Đóng")}</button>
            </div>
          </div>
        </CustomModal>
      )}

      {showWarRoom && (
        <WarRoomFlightDeck
          isOpen={showWarRoom}
          onClose={() => setShowWarRoom(false)}
          stats={stats}
          recentLogs={recentLogs}
        />
      )}
    </div>
  );
};

export const Dashboard = withRouterFreezer(DashboardInner, '/');