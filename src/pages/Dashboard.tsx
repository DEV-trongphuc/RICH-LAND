import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, AlertTriangle, RefreshCw,
  ArrowUpRight, ArrowDownRight, GitBranch, UserPlus, Zap, CheckCircle, Calendar, BarChart2, Scale,
  FileSpreadsheet, MessageCircle, Database, Server
} from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart,
  PieChart, Pie, Cell, BarChart, LabelList
} from 'recharts';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchAPI } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { KpiCardSkeleton, Skeleton } from '../components/ui/Skeleton';

import { Avatar } from '../components/ui/Avatar';

export const Dashboard = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === '/';
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('Tháng này');
  const [chartMode, setChartMode] = useState<'day' | 'hour'>('day');
  const [sourceViewMode, setSourceViewMode] = useState<'connection' | 'lead'>('connection');
  const [settings, setSettings] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [showHealthModal, setShowHealthModal] = useState(false);

  const isSingleDay = dateFilter === 'Hôm nay' || dateFilter === 'Hôm qua';
  const displayChartMode = isSingleDay ? 'hour' : chartMode;

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
      const [statsJson, logsJson, settingsJson, connectionsJson] = await Promise.all([
        fetchAPI(`get_dashboard_stats&date=${encodeURIComponent(dateFilter)}&chart_mode=${displayChartMode}`),
        fetchAPI('get_logs&exclude_status=silent'),
        fetchAPI('get_settings'),
        fetchAPI('get_connections')
      ]);

      // Kiểm tra xem request đã bị hủy chưa (user đổi filter trước khi response về)
      if (signal?.aborted) return;

      if (statsJson.success) setStats(statsJson.data);
      else console.error('Lỗi tải thống kê:', statsJson.message);

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
  }, [dateFilter, chartMode, isActive]);

  useEffect(() => {
    const handleLeadAdded = () => {
      if (isActive) {
        fetchDashboard();
      }
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, [dateFilter, chartMode, isActive]);

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
      color: '#7c3aed', // Purple for Total Data
      change: stats?.total_change,
      up: (stats?.total_change || '').startsWith('+')
    },
    {
      id: 'distributed',
      statusValue: 'assigned,compensation,rule_6_month,pending_work_hours',
      label: t('ĐÃ CHIA VÒNG THÀNH CÔNG'),
      value: stats?.distributed_today?.toLocaleString() || '0',
      icon: UserPlus,
      color: '#3b82f6', // Blue for Distributed
      change: stats?.distributed_change,
      up: (stats?.distributed_change || '').startsWith('+')
    },
    {
      id: 'duplicates',
      statusValue: 'reminder',
      label: t('BỊ TRÙNG LẶP (< 6 THÁNG)'),
      value: stats?.duplicates?.toLocaleString() || '0',
      icon: AlertTriangle,
      color: '#f59e0b', // Amber/Yellow for Duplicates
      change: stats?.duplicates_change,
      up: !(stats?.duplicates_change || '').startsWith('+')
    },
    {
      id: 'errors',
      statusValue: 'error,blacklisted,rejected,pending_approval',
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

    setDateFilter(label);
    setShowDateModal(false);
  };

  const aiPassed = stats?.ai_passed_count || 0;
  const aiFailed = stats?.ai_failed_count || 0;
  const aiTotal = aiPassed + aiFailed;
  const aiPassedPercent = aiTotal > 0 ? Math.round((aiPassed / aiTotal) * 100) : 0;
  const aiFailedPercent = aiTotal > 0 ? 100 - aiPassedPercent : 0;

  return (
    <div style={{ animation: 'slideUp 0.3s ease-out', position: 'relative' }}>
      {/* Background loading bar indicator */}
      {loading && stats && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--color-primary-light)', zIndex: 9999, overflow: 'hidden' }}>
          <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
        </div>
      )}
      <style>{`
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
      `}</style>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t("Tổng quan Phân bổ Data")}</h1>
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
                setDateFilter(String(val));
              }}
              width="100%"
            />
          </div>
          {/* Button to open Connection Health Modal */}
          <button
            className="btn outline"
            onClick={() => setShowHealthModal(true)}
            title={t("Kiểm tra kết nối hệ thống")}
            style={{ width: 38, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Server size={16} />
          </button>
          <button
            className="btn outline"
            onClick={() => fetchDashboard()}
            disabled={loading}
            title={t("Làm mới dữ liệu")}
            style={{ width: 38, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>
      {/* AI Pre-screener evaluation strip */}
      {!loading && stats && (stats.ai_screener_enabled === 1 || stats.ai_screener_enabled === '1' || stats.ai_screener_enabled === true) && (
        <div 
          className="card hover-lift" 
          onClick={() => navigate('/gatekeeper')}
          style={{ 
            padding: '1rem 1.5rem', 
            marginBottom: '1.25rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.75rem', 
            animation: 'fadeIn 0.3s ease-out',
            background: theme === 'dark' ? 'rgba(124, 58, 237, 0.12)' : 'rgba(124, 58, 237, 0.04)',
            border: theme === 'dark' ? '1px solid rgba(124, 58, 237, 0.25)' : '1px solid rgba(124, 58, 237, 0.12)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src="https://crm-domation.vercel.app/LOGO.jpg" 
                alt="DOMATION AI Logo" 
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
      )}

      {/* KPI Cards */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {loading && !stats ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="stat-card hover-lift"
              style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => navigate(`/data?status=${card.statusValue}&date=${encodeURIComponent(dateFilter)}`)}
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
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', display: 'inline-block', flexShrink: 0 }} />
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
                <div className={`stat-change ${card.up !== false ? 'up' : 'down'}`} style={{ marginTop: 'auto' }}>
                  {card.up !== false ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {card.change || '+0%'}
                  <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>{getComparisonLabel(dateFilter)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + List row */}
      {loading && !stats ? (
        <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <Skeleton width={220} height={16} style={{ marginBottom: 8 }} />
            <Skeleton width={300} height={11} style={{ marginBottom: 24 }} />
            <Skeleton width="100%" height={260} borderRadius={12} />
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
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
          <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{t('Hiệu suất xử lý Data theo')} {displayChartMode === 'hour' ? t('giờ') : t('ngày')}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '2px' }}>{t('Biểu đồ thể hiện lưu lượng Data đổ về')} {dateFilter === 'Tùy chỉnh' ? t('trong khoảng thời gian đã chọn') : `${t('trong')} ${getDisplayDateFilterText(dateFilter).toLowerCase()}`}.</p>
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
                </div>
              )}
            </div>
            {stats?.chartData && stats.chartData.length > 0 ? (
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
                  <Bar dataKey="volume" fill="#7c3aed" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={20}>
                    <LabelList dataKey="volume" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 700 }} offset={6} />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                {t('Chưa có dữ liệu thống kê')}
              </div>
            )}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('Lịch sử giao Data gần đây')}</h3>
              <span
                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => navigate(`/data?date=${encodeURIComponent(dateFilter)}`)}
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
                      onClick={() => navigate(`/data?search=${encodeURIComponent(log.phone)}`)}
                    >
                      <Avatar
                        src={
                          log.status === 'pending_approval'
                            ? '/imgs/warn_icon.png'
                            : log.status === 'rejected'
                              ? 'https://crm-domation.vercel.app/LOGO.jpg'
                              : log.status === 'blacklisted'
                                ? '/imgs/angry_icon.jpg'
                                : log.assigned_to_avatar
                        }
                        name={
                          log.status === 'pending_approval'
                            ? 'Domation AI - Screener'
                            : log.status === 'rejected'
                              ? 'Domation AI - Evaluator'
                              : log.status === 'blacklisted'
                                ? 'Domation AI - Angry'
                                : (log.assigned_to_name || t('Hệ thống'))
                        }
                        size={32}
                      />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {log.status === 'pending_approval'
                            ? 'Domation AI - Screener'
                            : log.status === 'rejected'
                              ? 'Domation AI - Evaluator'
                              : log.status === 'blacklisted'
                                ? 'Domation AI - Angry'
                                : (log.assigned_to_name || t('Hệ thống'))}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.lead_name || t('Khách hàng')} • {new Date(log.created_at).toLocaleString(language === 'en' ? 'en-US' : 'vi-VN')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {(() => {
                          const getBadgeConfig = (status: string, roundName?: string, reportStatus?: string) => {
                            if (status === 'error' && reportStatus === 'approved') {
                              return { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', text: 'Ticket' };
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
                              case 'reminder':
                                return {
                                  bg: theme === 'dark' ? 'rgba(219, 39, 119, 0.15)' : '#fce7f3',
                                  color: theme === 'dark' ? '#f472b6' : '#db2777',
                                  text: t('Nhắc lại')
                                };
                              default:
                                return { bg: 'var(--color-border)', color: 'var(--color-text-muted)', text: status };
                            }
                          };
                          const badge = getBadgeConfig(log.status, log.round_name, log.report_status);
                          return (
                            <span className="badge" style={{ background: badge.bg, color: badge.color, border: 'none', padding: '4px 8px', fontSize: '0.65rem' }}>
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
                  <GitBranch size={18} color="#8b5cf6" /> {t('Tỷ lệ Nguồn Data')}
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
                  <CheckCircle size={18} color="#10b981" /> {t('Thống kê lỗi Ticket')}
                </h3>
              </div>
              <div style={{ flex: 1, minHeight: 260 }}>
                {stats?.errorStats && stats.errorStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stats.errorStats} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.8} />
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
                        cursor={{ fill: 'rgba(16, 185, 129, 0.04)' }}
                        contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: 'var(--color-success)', fontWeight: 600 }}
                      />
                      <Bar dataKey="errors" fill="url(#successGradient)" radius={[4, 4, 0, 0]} barSize={28} name={t("Số lỗi được duyệt")}>
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
        </>
      )}{/* end stats ternary */}
      {/* Date Picker Modal */}
      <CustomModal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        title={t("Tùy chỉnh thời gian")}
        width="400px"
      >
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

                  {/* KPI Cards Row (4 Columns) */}
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--color-primary-light)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(124, 58, 237, 0.1)' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Thành công')}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
                        {statsData.summary.successful}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Data đã bàn giao')}</div>
                    </div>

                    <div style={{ background: 'var(--color-warning-light)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Nhắc lại')}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: 4 }}>
                        {statsData.summary.reminder || 0}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Yêu cầu gọi lại')}</div>
                    </div>

                    <div style={{ background: 'var(--color-danger-light)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Lỗi')}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 4 }}>
                        {statsData.summary.error || 0}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Trùng lặp / Lỗi chia')}</div>
                    </div>

                    <div style={{ background: 'var(--color-success-light)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Tỷ lệ')}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 4 }}>
                        {statsData.summary.system_total_successful > 0
                          ? Math.round((statsData.summary.successful / statsData.summary.system_total_successful) * 100)
                          : 0}%
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t('Thành công / Tổng của tất cả saleperson')}</div>
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
                                <stop offset="0%" stopColor="#c084fc" stopOpacity={1} />
                                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8} />
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
                          { name: t('Thành công'), value: statsData.summary.successful, color: '#7c3aed' },
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
                              <Bar dataKey="successful_count" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} barSize={12} name={t("Thành công")} />
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
                                  <div style={{ width: `${sourcePercent}%`, height: '100%', background: '#8b5cf6', borderRadius: 2 }} />
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
          onClose={() => setShowHealthModal(false)}
          title={t("Trạng thái kết nối hệ thống")}
          width="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
              {t("Kiểm tra trạng thái cấu hình và kết nối thời gian thực của các kênh tích hợp.")}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* 1. Google Sheets Connection */}
              <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
                    <FileSpreadsheet size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Google Sheets Script</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Webhook nhận dữ liệu từ Sheets")}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {connections && connections.length > 0 ? `${connections.length} ${t('kết nối')}` : t('Chưa kết nối')}
                  </span>
                  <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: connections && connections.length > 0 ? 'var(--color-success)' : 'var(--color-warning)' }} />
                </div>
              </div>

              {/* 2. Zalo Notification Bot */}
              <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: settings?.zalo_bot_token ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: settings?.zalo_bot_token ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    <MessageCircle size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Zalo Notification Bot</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Gửi thông báo phân bổ Lead cho Sale")}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {settings?.zalo_bot_token ? t('Đang hoạt động') : t('Chưa cấu hình')}
                  </span>
                  <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: settings?.zalo_bot_token ? 'var(--color-success)' : 'var(--color-danger)' }} />
                </div>
              </div>

              {/* 3. AI Pre-screener Filter */}
              <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: (settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: (settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    <Zap size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>AI Pre-screener (Gemini)</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Lọc và kiểm tra chất lượng bằng AI")}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {(settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? t('Đang hoạt động') : t('Đang tắt')}
                  </span>
                  <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: (settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? 'var(--color-success)' : 'var(--color-warning)' }} />
                </div>
              </div>

              {/* 4. Core Distribution System */}
              <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
                    <Database size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Distribution Engine</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Lõi điều tuyến chia số tự động")}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {t('Đang hoạt động')}
                  </span>
                  <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button className="btn primary sm" onClick={() => setShowHealthModal(false)}>{t("Đóng")}</button>
            </div>
          </div>
        </CustomModal>
      )}
    </div>
  );
};
