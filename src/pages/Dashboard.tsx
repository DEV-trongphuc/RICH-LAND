import { useEffect, useState } from 'react';
import {
  Users, AlertTriangle, RefreshCw,
  Clock, ArrowUpRight, ArrowDownRight, GitBranch, UserPlus, Zap
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

export const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('Hôm nay');

  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const json = await fetchAPI(`get_dashboard_stats&date=${encodeURIComponent(dateFilter)}`);
      if (json.success) setStats(json.data);
      
      const logsJson = await fetchAPI('get_logs');
      if (logsJson.success) setRecentLogs(logsJson.data.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDashboard(); }, [dateFilter]);

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
    { value: '7 ngày qua', label: '7 ngày qua' }
  ];

  if (!['Hôm nay', 'Hôm qua', '7 ngày qua', 'Tùy chỉnh'].includes(dateFilter)) {
    dateOptions.push({ value: dateFilter, label: dateFilter });
  }

  dateOptions.push({ value: 'Tùy chỉnh', label: 'Tùy chỉnh...' });

  const handleCustomDateSubmit = () => {
    if (!startDate || !endDate) return toast.error("Vui lòng chọn đầy đủ Từ ngày và Đến ngày");
    if (new Date(startDate) > new Date(endDate)) return toast.error("Từ ngày không được lớn hơn Đến ngày");
    
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    
    const formatStr = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    const label = `${formatStr(startObj)} - ${formatStr(endObj)}`;
    
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
            onClick={fetchDashboard}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* KPI Cards — Exact match with F:\CRM */}
      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        {kpiCards.map((card, i) => {
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

      <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

        {/* CHART SECTION - Using exact F:\CRM Recharts structure */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>Hiệu suất xử lý Data theo giờ</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '2px' }}>Biểu đồ thể hiện lưu lượng Data đổ về trong ngày hôm nay.</p>
            </div>
          </div>

          {stats?.chartData && stats.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={stats.chartData} margin={{ left: -20, right: 5, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: 'white', padding: '12px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary)' }}>Lưu lượng Data: <span style={{ fontWeight: 800 }}>{payload[0].value}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }} 
                />
                <Bar dataKey="volume" fill="#7c3aed" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              Chưa có dữ liệu thống kê
            </div>
          )}
        </div>

        {/* LIST SECTION */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Lịch sử giao Data gần đây</h3>
            <span 
              style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer' }}
              onClick={() => navigate(`/data?date=${encodeURIComponent(dateFilter)}`)}
            >Xem tất cả</span>
          </div>
          <div style={{ flex: 1, padding: '0.5rem', overflowY: 'auto', maxHeight: 260 }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Đang tải...</div>
            ) : recentLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {recentLogs.map((log) => (
                  <div key={log.id} className="hover-lift" style={{
                    padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                    borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'background 0.2s',
                    borderBottom: '1px solid var(--color-border-light)'
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => navigate(`/data?search=${log.phone}`)}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--color-primary)' }}>
                      <Clock size={16} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                        {log.name || 'Khách hàng'} • {log.phone}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.source || 'Nguồn Data'} • {log.type || 'Chưa phân loại'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{ background: log.status === 'assigned' ? 'var(--color-success-light)' : 'var(--color-border)', color: log.status === 'assigned' ? 'var(--color-success)' : 'var(--color-text)', border: 'none', padding: '2px 8px', fontSize: '0.65rem' }}>
                        {log.status === 'assigned' ? 'Đã chia' : (log.status === 'duplicate' ? 'Trùng lặp' : log.status)}
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

      {/* NEW STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Top Consultants */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
              <Users size={18} color="var(--color-primary)" /> Top Tư vấn viên nhận Data
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'center' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, justifyContent: 'center' }}>
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
