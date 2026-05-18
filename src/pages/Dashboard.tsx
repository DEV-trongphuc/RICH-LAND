import { useEffect, useState } from 'react';
import {
  Users, AlertTriangle, RefreshCw,
  ArrowUpRight, ArrowDownRight, GitBranch, UserPlus, Zap
} from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart
} from 'recharts';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { KpiCardSkeleton, Skeleton } from '../components/ui/Skeleton';

import { Avatar } from '../components/ui/Avatar';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('Hôm nay');

  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDashboard = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      // BUG-04 fix: Dùng Promise.all để gọi song song, tiết kiệm ~1-2s
      // BUG-06 fix: Xử lý lỗi riêng từng API, không để lỗi một cái 'nuốt' cái kia
      const [statsJson, logsJson] = await Promise.all([
        fetchAPI(`get_dashboard_stats&date=${encodeURIComponent(dateFilter)}`),
        fetchAPI('get_logs')
      ]);
      
      // Kiểm tra xem request đã bị hủy chưa (user đổi filter trước khi response về)
      if (signal?.aborted) return;
      
      if (statsJson.success) setStats(statsJson.data);
      else console.error('Lỗi tải thống kê:', statsJson.message);
      
      if (logsJson.success) setRecentLogs(logsJson.data.slice(0, 5));
      else console.error('Lỗi tải nhật ký:', logsJson.message);
    } catch (e: any) {
      // BUG-04 fix: Bỏ qua lỗi AbortError (do user đổi filter nhanh) - đây KHÔNG phải lỗi thực sự
      if (e?.name !== 'AbortError') {
        console.error('Dashboard fetch error:', e);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    // BUG-04 fix: Tạo AbortController để hủy fetch cũ khi dateFilter thay đổi nhanh
    const abortController = new AbortController();
    fetchDashboard(abortController.signal);
    return () => abortController.abort(); // Cleanup: hủy khi component unmount hoặc dateFilter đổi
  }, [dateFilter]);

  const kpiCards = [
    {
      id: 'total',
      statusValue: 'all',
      label: 'TỔNG DATA TIẾP NHẬN',
      value: stats?.total_today?.toLocaleString() || '0',
      icon: GitBranch,
      color: '#7c3aed', // Purple for Total Data
      change: stats?.total_change,
      up: (stats?.total_change || '').startsWith('+')
    },
    {
      id: 'distributed',
      statusValue: 'assigned',
      label: 'ĐÃ CHIA VÒNG THÀNH CÔNG',
      value: stats?.distributed_today?.toLocaleString() || '0',
      icon: UserPlus,
      color: '#3b82f6', // Blue for Distributed
      change: stats?.distributed_change,
      up: (stats?.distributed_change || '').startsWith('+')
    },
    {
      id: 'duplicates',
      statusValue: 'duplicate',
      label: 'BỊ TRÙNG LẶP (< 6 THÁNG)',
      value: stats?.duplicates?.toLocaleString() || '0',
      icon: AlertTriangle,
      color: '#f59e0b', // Amber/Yellow for Duplicates
      change: stats?.duplicates_change,
      up: !(stats?.duplicates_change || '').startsWith('+')
    },
    {
      id: 'errors',
      statusValue: 'error',
      label: 'DATA LỖI / KHÔNG XÁC ĐỊNH',
      value: stats?.errors?.toLocaleString() || '0',
      icon: Zap,
      color: '#ef4444', // Red for Errors
      change: stats?.errors_change,
      up: !(stats?.errors_change || '').startsWith('+')
    }
  ];


  const dateOptions = [
    { value: 'Hôm nay', label: 'Hôm nay' },
    { value: 'Hôm qua', label: 'Hôm qua' },
    { value: '7 ngày qua', label: '7 ngày qua' },
    { value: '30 ngày qua', label: '30 ngày qua' },
    { value: 'Tháng này', label: 'Tháng này' },
    { value: 'Tháng trước', label: 'Tháng trước' }
  ];

  const defaultFilters = ['Hôm nay', 'Hôm qua', '7 ngày qua', '30 ngày qua', 'Tháng này', 'Tháng trước', 'Tùy chỉnh'];
  if (!defaultFilters.includes(dateFilter)) {
    dateOptions.push({ value: dateFilter, label: dateFilter });
  }

  dateOptions.push({ value: 'Tùy chỉnh', label: 'Tùy chỉnh...' });

  const handleCustomDateSubmit = () => {
    if (!startDate || !endDate) return toast.error("Vui lòng chọn đầy đủ Từ ngày và Đến ngày");
    if (new Date(startDate) > new Date(endDate)) return toast.error("Từ ngày không được lớn hơn Đến ngày");
    
    // BUG-HIGH-1 fix: api.php expects format 'YYYY-MM-DD đến YYYY-MM-DD'
    // startDate/endDate from <input type="date"> are already in YYYY-MM-DD format
    const label = `${startDate} đến ${endDate}`;
    
    setDateFilter(label);
    setShowDateModal(false);
  };

  return (
    <div style={{ animation: 'slideUp 0.3s ease-out' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800 }}>Tổng quan Phân bổ Data</h1>
          <p className="page-subtitle">Phân tích hiệu suất giao data theo thời gian thực — Hệ thống đang hoạt động trơn tru.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative', zIndex: 100 }}>
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
              width={200}
            />
          </div>
          <button
            className="btn outline"
            onClick={() => fetchDashboard()}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {loading ? (
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
                <span className="stat-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>{card.label}</span>
                <div style={{ color: card.color, opacity: 0.8 }}><Icon size={20} /></div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)' }}>{card.value}</div>
                <div className={`stat-change ${card.up !== false ? 'up' : 'down'}`} style={{ marginTop: 'auto' }}>
                  {card.up !== false ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {card.change || '+0%'}
                  <span style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>so với hôm qua</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + List row */}
      {loading ? (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>Hiệu suất xử lý Data theo {dateFilter === 'Hôm nay' || dateFilter === 'Hôm qua' ? 'giờ' : 'ngày'}</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '2px' }}>Biểu đồ thể hiện lưu lượng Data đổ về {dateFilter === 'Tùy chỉnh' ? 'trong khoảng thời gian đã chọn' : `trong ${dateFilter.toLowerCase()}`}.</p>
              </div>
            </div>
            {stats?.chartData && stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={stats.chartData} margin={{ left: -20, right: 5, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary)' }}>Lưu lượng Data: <span style={{ fontWeight: 800 }}>{payload[0].value}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="volume" fill="#7c3aed" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={20} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                Chưa có dữ liệu thống kê
              </div>
            )}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Lịch sử giao Data gần đây</h3>
              <span 
                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => navigate(`/data?date=${encodeURIComponent(dateFilter)}`)}
              >Xem tất cả</span>
            </div>
            <div style={{ flex: 1, padding: '0.5rem', overflowY: 'auto', maxHeight: 260 }}>
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
                      <Avatar name={log.assigned_to_name || 'Hệ thống'} size={32} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {log.assigned_to_name || 'Hệ thống'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.lead_name || 'Khách hàng'} • {new Date(log.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="badge" style={{ background: log.status === 'assigned' ? 'var(--color-success-light)' : 'var(--color-border)', color: log.status === 'assigned' ? 'var(--color-success)' : 'var(--color-text)', border: 'none', padding: '4px 8px', fontSize: '0.65rem' }}>
                          {log.status === 'assigned' ? (log.round_name || 'Đã chia') : (log.status === 'duplicate' ? 'Trùng lặp' : log.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Không có data mới</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Source Pie + Quality row */}
      {loading ? (
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
      <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Top Consultants */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <Users size={18} color="var(--color-primary)" /> Top Tư vấn viên nhận Data
            </h3>
          </div>
          <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
            {stats?.topConsultants && stats.topConsultants.length > 0 ? stats.topConsultants.map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>#{i + 1}</span>
                    {c.name}
                  </span>
                  <span style={{ color: 'var(--color-text)' }}>{c.data} lead</span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${c.percent}%`, height: '100%', background: c.color, borderRadius: 4 }} />
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Chưa có dữ liệu thống kê</div>
            )}
          </div>
        </div>

        {/* Round Assignment Ratio */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <GitBranch size={18} color="#3b82f6" /> Tỷ lệ theo Vòng Phân Bổ
            </h3>
          </div>
          <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
            {stats?.roundRatio && stats.roundRatio.length > 0 ? stats.roundRatio.map((r: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{r.round}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.percent}% tổng data</div>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{r.count}</div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Chưa có dữ liệu thống kê</div>
            )}
          </div>
        </div>
      </div>
      )}{/* end stats ternary */}
      {/* Date Picker Modal */}
      <CustomModal 
        isOpen={showDateModal} 
        onClose={() => setShowDateModal(false)} 
        title="Tùy chỉnh thời gian"
        width="400px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
          <div>
            <label className="form-label">Từ ngày</label>
            <input 
              type="date" 
              className="form-input" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>
          <div>
            <label className="form-label">Đến ngày</label>
            <input 
              type="date" 
              className="form-input" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn outline" onClick={() => setShowDateModal(false)}>Hủy</button>
            <button className="btn primary" onClick={handleCustomDateSubmit}>Áp dụng</button>
          </div>
        </div>
      </CustomModal>
    </div>
  );
};
