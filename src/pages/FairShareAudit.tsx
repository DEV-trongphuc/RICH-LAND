import { useEffect, useState } from 'react';
import {
  Scale, Users, AlertTriangle, BarChart2, Info,
  TrendingUp, Sparkles, CheckCircle, Layers, Ticket
} from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Legend
} from 'recharts';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { KpiCardSkeleton, Skeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';

export const FairShareAudit = () => {
  const [data, setData] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('Tháng này');
  const [roundFilter, setRoundFilter] = useState('');

  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Fetch Rounds for the dropdown filter
  const fetchRounds = async () => {
    try {
      const res = await fetchAPI('get_rounds');
      if (res.success) {
        setRounds(res.data || []);
      }
    } catch (e) {
      console.error('Error fetching rounds:', e);
    }
  };

  const fetchStats = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const url = `get_fair_share_stats&date=${encodeURIComponent(dateFilter)}&round_id=${roundFilter}`;
      const res = await fetchAPI(url);
      if (signal?.aborted) return;

      if (res.success) {
        setData(res.data);
      } else {
        toast.error(res.message || 'Lỗi tải dữ liệu đối soát');
      }
    } catch (e) {
      console.error('Error fetching fair share stats:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    fetchStats(abortController.signal);
    return () => abortController.abort();
  }, [dateFilter, roundFilter]);

  const handleCustomDateSubmit = () => {
    if (!startDate || !endDate) return toast.error("Vui lòng chọn đầy đủ Từ ngày và Đến ngày");
    if (new Date(startDate) > new Date(endDate)) return toast.error("Từ ngày không được lớn hơn Đến ngày");

    const label = `${startDate} đến ${endDate}`;
    setDateFilter(label);
    setShowDateModal(false);
  };

  const getFairnessLevel = (index: number) => {
    if (index >= 90) return { label: 'Rất công bằng', color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', desc: 'Thuật toán đang phân phối data cực kỳ đồng đều.' };
    if (index >= 75) return { label: 'Bình thường', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', desc: 'Có sự chênh lệch nhẹ (thường do tỷ lệ thiết lập hoặc Sale tạm vắng).' };
    return { label: 'Cần điều chỉnh', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', desc: 'Độ lệch phân phối cao. Vui lòng rà soát lại cấu hình lượt và ca làm việc.' };
  };

  const dateOptions = [
    { value: 'Hôm nay', label: 'Hôm nay' },
    { value: 'Hôm qua', label: 'Hôm qua' },
    { value: 'Tuần này', label: 'Tuần này' },
    { value: 'Tuần trước', label: 'Tuần trước' },
    { value: 'Tuần trước nữa', label: 'Tuần trước nữa' },
    { value: '7 ngày qua', label: '7 ngày qua' },
    { value: '30 ngày qua', label: '30 ngày qua' },
    { value: 'Tháng này', label: 'Tháng này' },
    { value: 'Tháng trước', label: 'Tháng trước' }
  ];

  const defaultFilters = ['Hôm nay', 'Hôm qua', 'Tuần này', 'Tuần trước', 'Tuần trước nữa', '7 ngày qua', '30 ngày qua', 'Tháng này', 'Tháng trước', 'Tùy chỉnh'];
  if (!defaultFilters.includes(dateFilter)) {
    dateOptions.push({ value: dateFilter, label: dateFilter });
  }
  dateOptions.push({ value: 'Tùy chỉnh', label: 'Tùy chỉnh...' });

  const roundOptions = [
    { value: '', label: 'Tất cả các Vòng' },
    ...rounds.map(r => ({ value: String(r.id), label: r.round_name }))
  ];

  // Formatting chart data for Data Source Balance
  const sourceChartData = data?.consultants ? data.consultants.map((c: any) => {
    const item: any = { name: c.name };
    data.sources.forEach((src: string) => {
      item[src] = c.sources[src] || 0;
    });
    return item;
  }) : [];

  // Formatting chart data for Lead Quality (Assigned vs Duplicate vs Faulty Approved)
  const qualityChartData = data?.consultants ? data.consultants.map((c: any) => ({
    name: c.name,
    'Data bàn giao': c.assigned_count,
    'Ticket': c.total_ticket_count,
    'Duyệt Ticket': c.ticket_count
  })) : [];

  const sourceColors = ['#6366f1', '#10b981', '#fbbf24', '#f43f5e', '#a855f7', '#06b6d4'];

  // Custom legend renderer for balanced charts - Styled exactly like Tỷ lệ Nguồn Data
  const renderCustomLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: '6px 12px',
        width: '100%',
        marginTop: '12px',
        padding: '0 24px',
        fontSize: '0.75rem',
        color: 'var(--color-text-light)'
      }}>
        {payload.map((entry: any, index: number) => {
          let color = entry.color;
          if (entry.value === 'Data bàn giao') color = 'var(--color-primary)';
          else if (entry.value === 'Ticket') color = '#fbbf24';
          else if (entry.value === 'Duyệt Ticket') color = '#10b981';
          else {
            const sIdx = data?.sources?.indexOf(entry.value);
            if (sIdx !== undefined && sIdx !== -1) {
              color = sourceColors[sIdx % sourceColors.length];
            }
          }
          return (
            <div
              key={index}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
              title={entry.value}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--color-text)' }}>
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Custom visual components for Recharts tooltips
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
          color: '#f8fafc'
        }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'white', marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
            {label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {payload.map((p: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, fontSize: '0.75rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill }} />
                  {p.name}
                </span>
                <span style={{ fontWeight: 800, color: 'white' }}>{p.value} lead</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Automated smart insights calculation based on Fairness Gini Index & Deviations
  const renderSmartInsights = () => {
    if (!data || !data.consultants || data.consultants.length === 0) return null;

    const fairness = data.fairnessIndex || 0;

    // If fairness is good (>= 75), do not render the insights box
    if (fairness >= 75) return null;

    // Find highest surplus and highest deficit
    let maxSurplus = 0;
    let maxSurplusSale: any = null;
    let maxDeficit = 0;
    let maxDeficitSale: any = null;

    data.consultants.forEach((c: any) => {
      const targetShare = data.mean * c.receive_ratio;
      const diff = c.assigned_count - targetShare;
      const diffPercent = targetShare > 0 ? (diff / targetShare) * 100 : 0;

      if (diff > maxSurplus) {
        maxSurplus = diff;
        maxSurplusSale = { ...c, diff, diffPercent };
      }
      if (diff < maxDeficit) {
        maxDeficit = diff;
        maxDeficitSale = { ...c, diff, diffPercent };
      }
    });

    const title = `Khuyến Nghị Cần Điều Chỉnh: Phát hiện độ lệch phân phối cao (${fairness}%)`;
    const bgColor = 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(239, 68, 68, 0.08) 100%)';
    const borderColor = 'rgba(239, 68, 68, 0.2)';
    const borderLeftColor = '#ef4444';
    const iconColor = '#ef4444';
    const titleColor = '#991b1b';
    const descColor = '#b91c1c';

    return (
      <div style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${borderLeftColor}`,
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
      }}>
        <div style={{ background: `${iconColor}15`, padding: 8, borderRadius: '50%', color: iconColor, flexShrink: 0 }}>
          <AlertTriangle size={18} />
        </div>
        <div>
          <h4 style={{ fontWeight: 800, fontSize: '0.875rem', color: titleColor, marginBottom: 4 }}>
            {title}
          </h4>
          <div style={{ fontSize: '0.8125rem', color: descColor, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              {maxSurplusSale && (
                <span>
                  • Tư vấn viên <strong>{maxSurplusSale.name}</strong> đang nhận vượt chỉ tiêu <strong>+{maxSurplusSale.diff.toFixed(1)} lead</strong> (+{maxSurplusSale.diffPercent.toFixed(0)}%).
                </span>
              )}
              {maxDeficitSale && (
                <span style={{ marginLeft: maxDeficitSale ? '12px' : 0 }}>
                  • <strong>{maxDeficitSale.name}</strong> đang nhận thiếu chỉ tiêu <strong>{maxDeficitSale.diff.toFixed(1)} lead</strong> ({maxDeficitSale.diffPercent.toFixed(0)}%).
                </span>
              )}
            </div>
            <p style={{ margin: 0, opacity: 0.9 }}>
              <strong>Gợi ý xử lý:</strong> Cân nhắc kiểm tra lại cấu hình lượt xoay ca trực trong mục <strong>Vòng phân bổ</strong>, trạng thái hoạt động trực tuyến (Zalo/Web) của các TVV trên, hoặc tạm thời giảm Tỷ lệ (Ratio) nhận của <strong>{maxSurplusSale?.name}</strong> xuống để hệ thống tự động bù số cho <strong>{maxDeficitSale?.name}</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: 'slideUp 0.3s ease-out', position: 'relative' }} className="fade-in-view">
      {/* Background loading bar */}
      {loading && data && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--color-primary-light)', zIndex: 9999, overflow: 'hidden' }}>
          <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Scale size={28} color="var(--color-primary)" /> Đối Soát Độ Công Bằng Phân Phối
          </h1>
          <p className="page-subtitle">Kiểm tra toán học & đo lường độ lệch chuẩn, chỉ số Gini để đảm bảo data được chia công bằng.</p>
        </div>
        <div className="mobile-w-full" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="mobile-flex-1" style={{ position: 'relative', zIndex: 100, width: 180 }}>
            <CustomSelect
              options={roundOptions}
              value={roundFilter}
              onChange={(val) => setRoundFilter(String(val))}
              width="100%"
            />
          </div>
          <div className="mobile-flex-1" style={{ position: 'relative', zIndex: 100, width: 160 }}>
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
          <button
            className="btn outline"
            onClick={() => setShowInfoModal(true)}
            title="Giải thích chỉ số"
            style={{ width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Info size={16} />
          </button>
        </div>
      </div>

      {/* Intro explain card styled identically to RuleSettings */}
      <div className="hide-on-mobile" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.1) 100%)',
        border: '1px solid var(--color-primary-light)', borderLeft: '4px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem'
      }}>
        <div style={{
          background: 'var(--color-card, #fff)',
          width: 40, height: 40, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', boxShadow: 'var(--shadow-sm)', color: 'var(--color-primary)'
        }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: 4 }}>
            Báo cáo Đối soát Công bằng hoạt động thế nào?
          </h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
            Hệ thống áp dụng công thức <strong>Hệ số bất bình đẳng Gini</strong> và <strong>Độ lệch chuẩn</strong> thực tế của lượng data bàn giao cho Sale.
            Chỉ số Công bằng được tính toán bằng cách chuẩn hóa lượng data nhận được chia cho Tỷ lệ (Receive Ratio) thiết lập của từng Sale.
            Giúp bạn ngay lập tức phát hiện xem có sự bất bình đẳng ngoài ý muốn do lỗi phân phối hoặc Sale offline kéo dài hay không.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            {/* Fairness Index Card */}
            {(() => {
              const level = getFairnessLevel(data?.fairnessIndex || 0);
              return (
                <div className="stat-card hover-lift" style={{ minHeight: '135px', display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${level.color}`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: 60, height: 60, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}10 0%, transparent 70%)` }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', zIndex: 1 }}>
                    <span className="stat-label" style={{ fontWeight: 800 }}>CHỈ SỐ CÔNG BẰNG</span>
                    <Scale size={18} style={{ color: level.color }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '2rem', letterSpacing: '-0.02em' }}>{data?.fairnessIndex}%</span>
                      <span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 20, background: level.bg, color: level.color, fontWeight: 700, border: `1px solid ${level.color}20` }}>
                        {level.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 'auto', lineHeight: 1.4 }}>
                      {level.desc}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Standard Deviation Card */}
            <div className="stat-card hover-lift" style={{ minHeight: '135px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ fontWeight: 800 }}>ĐỘ LỆCH CHUẨN (SD)</span>
                <AlertTriangle size={18} color="#fbbf24" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '2rem', letterSpacing: '-0.02em' }}>± {data?.standardDeviation || 0}</span>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 'auto', lineHeight: 1.4 }}>
                  Chỉ số đo lường mức độ phân tán của số lượng lead. SD càng nhỏ có nghĩa là lượng data được chia càng đồng đều giữa các Sale.
                </div>
              </div>
            </div>

            {/* Average lead count card */}
            <div className="stat-card hover-lift" style={{ minHeight: '135px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ fontWeight: 800 }}>SỐ LEAD TRUNG BÌNH</span>
                <TrendingUp size={18} color="var(--color-primary)" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '2rem', letterSpacing: '-0.02em' }}>{data?.mean || 0}</span>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 'auto', lineHeight: 1.4 }}>
                  Số lượng lead trung bình được nhận bởi một Tư vấn viên trong vòng và khoảng thời gian đã chọn.
                </div>
              </div>
            </div>

            {/* Total Audited Leads */}
            <div className="stat-card hover-lift" style={{ minHeight: '135px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ fontWeight: 800 }}>TỔNG LEAD / SALEPERSONS</span>
                <Users size={18} color="#3b82f6" />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '2rem', letterSpacing: '-0.02em' }}>
                  {data?.totalLeads || 0} <span style={{ fontSize: '1rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>/ {data?.totalConsultants || 0} Saleperson</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 'auto', lineHeight: 1.4 }}>
                  Phạm vi kiểm toán gồm {data?.totalConsultants || 0} Tư vấn viên đang hoạt động với tổng số {data?.totalLeads || 0} lead thành công.
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Smart Auto-Tuning Insights Block */}
      {!loading && data && renderSmartInsights()}

      {/* Main Charts area */}
      <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>

        {/* Data Source Balance Chart */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>Phân Bổ Cân Bằng Theo Nguồn</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px' }}>
              Đảm bảo các Sale nhận số lượng lead chất lượng (FB Ads, Google) đồng đều, tránh dồn nguồn kém chất lượng cho một người.
            </p>
          </div>
          <div style={{ flex: 1, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading && !data ? (
              <Skeleton width="100%" height={300} borderRadius={16} />
            ) : sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={sourceChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }} barGap={5}>
                  <defs>
                    {sourceColors.map((color, idx) => (
                      <linearGradient key={`grad-src-${idx}`} id={`srcGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" horizontal={true} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'var(--color-border-light)', opacity: 0.3 }} />
                  <Legend content={renderCustomLegend} />
                  {data?.sources && data.sources.map((src: string, index: number) => (
                    <Bar
                      key={src}
                      dataKey={src}
                      stackId="a"
                      fill={`url(#srcGrad-${index})`}
                      radius={index === data.sources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      barSize={32}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Chưa có dữ liệu thống kê nguồn</div>
            )}
          </div>
        </div>

        {/* Quality breakdown bar chart */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>Chất Lượng Lead Nhận Được</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px' }}>
              Đối soát giữa tỷ lệ lead thật (bàn giao), lead bị trùng lặp, và số data báo lỗi đã được duyệt đền bù của từng Sale.
            </p>
          </div>
          <div style={{ flex: 1, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading && !data ? (
              <Skeleton width="100%" height={300} borderRadius={16} />
            ) : qualityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={qualityChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }} barGap={6}>
                  <defs>
                    <linearGradient id="assignedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.65} />
                    </linearGradient>
                    <linearGradient id="duplicateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.65} />
                    </linearGradient>
                    <linearGradient id="ticketGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" horizontal={true} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'var(--color-border-light)', opacity: 0.3 }} />
                  <Legend content={renderCustomLegend} />
                  <Bar dataKey="Data bàn giao" fill="url(#assignedGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="Ticket" fill="url(#duplicateGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="Duyệt Ticket" fill="url(#ticketGrad)" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Chưa có dữ liệu đối soát chất lượng</div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem', border: '1px solid var(--color-border)' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>Bảng Thống Kê Độ Lệch Chi Tiết</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '4px' }}>
              Chi tiết từng Sale trong vòng được audit: Tỷ lệ (Ratio) cài đặt, số lead nhận được, và đánh giá lệch so với trung bình hệ thống.
            </p>
          </div>
          <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 8, background: 'var(--color-border-light)', border: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-light)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Layers size={12} /> Số Sale được đo lường: {data?.consultants?.length || 0}
          </span>
        </div>

        <div className="responsive-table-wrap">
          {loading && !data ? (
            <div style={{ padding: '1.25rem' }}>
              <Skeleton width="100%" height={24} style={{ marginBottom: 12 }} />
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={56} style={{ marginBottom: 8 }} />)}
            </div>
          ) : data?.consultants && data.consultants.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }} className="audit-premium-table">
              <thead>
                <tr style={{ background: 'var(--color-border-light)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Tư vấn viên</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Vòng chia</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', textAlign: 'center' }}>Tỷ lệ (Ratio)</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', textAlign: 'center' }}>Lead Nhận</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Phân bổ theo Nguồn</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', textAlign: 'center' }}>Ticket</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', textAlign: 'center' }}>Duyệt Ticket</th>
                  <th style={{ padding: '14px 18px', fontSize: '0.72rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', textAlign: 'right' }}>Độ Lệch</th>
                </tr>
              </thead>
              <tbody>
                {data.consultants.map((c: any) => {
                  // Calculate deviation from mean adjusted by ratio
                  const targetShare = data.mean * c.receive_ratio;
                  const diff = c.assigned_count - targetShare;
                  const diffPercent = targetShare > 0 ? (diff / targetShare) * 100 : 0;

                  // Styling based on deviation
                  let deviationClass = 'deviation-balanced';
                  let deviationLabel = 'Cân bằng';
                  if (diff > 0) {
                    deviationClass = 'deviation-surplus';
                    deviationLabel = `+${diff.toFixed(1)} lead (+${diffPercent.toFixed(0)}%)`;
                  } else if (diff < 0) {
                    deviationClass = 'deviation-deficit';
                    deviationLabel = `${diff.toFixed(1)} lead (${diffPercent.toFixed(0)}%)`;
                  }

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border-light)', transition: 'all 0.25s ease' }} className="audit-table-row">
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ position: 'relative' }}>
                            <Avatar src={c.avatar} name={c.name} size={36} />
                            <span style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: '#10b981', border: '2px solid var(--color-surface)', display: 'block' }} />
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'block', fontSize: '0.875rem' }}>{c.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>ID: {c.id}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)', background: 'var(--color-bg)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--color-border)', display: 'inline-block' }}>
                          {c.round_name}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.06)', border: '1px dashed rgba(99, 102, 241, 0.3)', fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.8125rem' }}>
                          x{c.receive_ratio}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 900, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                        {c.assigned_count}
                      </td>
                      <td style={{ padding: '14px 18px', width: '260px', verticalAlign: 'middle' }}>
                        {c.assigned_count > 0 ? (
                          <div className="source-bar-container" style={{ position: 'relative', width: '100%', padding: '6px 0' }}>
                            <div style={{ display: 'flex', width: '100%', height: '8px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--color-border-light)' }}>
                              {data.sources.map((src: string, sIdx: number) => {
                                const val = c.sources[src] || 0;
                                if (val === 0) return null;
                                const pct = (val / c.assigned_count) * 100;
                                const color = sourceColors[sIdx % sourceColors.length];
                                return (
                                  <div
                                    key={src}
                                    style={{
                                      width: `${pct}%`,
                                      height: '100%',
                                      backgroundColor: color,
                                      transition: 'width 0.3s ease'
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <div className="source-tooltip">
                              <div style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: '6px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px', color: 'var(--color-text)' }}>
                                Phân bổ nguồn ({c.name})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {data.sources.map((src: string, sIdx: number) => {
                                  const val = c.sources[src] || 0;
                                  if (val === 0) return null;
                                  const pct = (val / c.assigned_count) * 100;
                                  const color = sourceColors[sIdx % sourceColors.length];
                                  return (
                                    <div key={src} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '0.7rem' }}>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-light)' }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                                        {src}
                                      </span>
                                      <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>
                                        {val} <span style={{ fontWeight: 500, opacity: 0.7, fontSize: '0.65rem' }}>({pct.toFixed(0)}%)</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', opacity: 0.6 }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {c.total_ticket_count > 0 ? (
                          <span style={{ color: '#d97706', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', background: 'rgba(245, 158, 11, 0.08)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                            <Ticket size={12} /> {c.total_ticket_count}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', opacity: 0.6 }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        {c.ticket_count > 0 ? (
                          <span style={{ color: '#10b981', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                            <CheckCircle size={12} /> {c.ticket_count}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', opacity: 0.6 }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <span className={`deviation-badge ${deviationClass}`}>
                          {deviationLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--color-text-muted)' }}>
              <CheckCircle size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Không tìm thấy dữ liệu phân phối phù hợp trong khoảng thời gian đã chọn.</p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Date Modal (from Dashboard.tsx) */}
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

      {/* Info Terminology Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Giải thích thuật ngữ & Công thức tính toán"
        width="550px"
        showCloseIcon={false}
      >
        <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '70vh', overflowY: 'auto' }} className="custom-scrollbar">
          <div>
            <h4 style={{ fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
              <Scale size={16} color="var(--color-primary)" /> Chỉ số công bằng (Fairness Index)
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 6, lineHeight: 1.5 }}>
              Được tính toán dựa trên <strong>Hệ số Gini (Gini Coefficient)</strong> đã được chuẩn hóa theo Tỷ lệ nhận lead (Receive Ratio) cài đặt của từng TVV.
              Công thức: <code>Fairness Index = (1 - Gini) * 100%</code>.
              Chỉ số đạt 100% tương đương với mức công bằng hoàn hảo (mọi Sale đều nhận được lượng lead tỷ lệ thuận tuyệt đối với cài đặt của họ).
            </p>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--color-border-light)' }} />

          <div>
            <h4 style={{ fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
              <AlertTriangle size={16} color="#fbbf24" /> Độ lệch chuẩn (Standard Deviation - SD)
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 6, lineHeight: 1.5 }}>
              Biểu thị mức độ phân tán của số lượng lead được chia xung quanh giá trị trung bình.
              Nếu SD = 0, tất cả các Sale nhận được số lượng lead hoàn toàn bằng nhau. SD càng nhỏ, thuật toán chia lead càng ít xảy ra sai số.
            </p>
          </div>

          <hr style={{ border: 0, borderTop: '1px solid var(--color-border-light)' }} />

          <div>
            <h4 style={{ fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
              <BarChart2 size={16} color="#3b82f6" /> Chuẩn hóa tỷ lệ phân bổ (Normalized Share)
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', marginTop: 6, lineHeight: 1.5 }}>
              Khi một vòng phân bổ thiết lập tỷ lệ chia cho Sale A là x2 và Sale B là x1, thì việc Sale A nhận được số lead gấp đôi Sale B là hoàn toàn công bằng.
              Thuật toán đối soát công bằng sẽ tự động chia số lead của từng Sale cho Ratio của họ trước khi chạy tính toán Gini để đảm bảo độ chính xác tuyệt đối.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn primary" onClick={() => setShowInfoModal(false)}>Đóng</button>
          </div>
        </div>
      </CustomModal>

      <style>{`
        /* Table Styles */
        .audit-premium-table th {
          background: var(--color-border-light) !important;
          color: var(--color-text-light) !important;
          border-bottom: 1px solid var(--color-border) !important;
        }
        .audit-table-row:hover {
          background-color: rgba(99, 102, 241, 0.03) !important;
          transform: translateX(4px);
        }
        [data-theme="dark"] .audit-table-row:hover {
          background-color: rgba(99, 102, 241, 0.06) !important;
        }
        
        /* Deviation Badges */
        .deviation-badge {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .deviation-balanced {
          background: rgba(16, 185, 129, 0.08);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .deviation-surplus {
          background: rgba(59, 130, 246, 0.08);
          color: #3b82f6;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .deviation-deficit {
          background: rgba(244, 63, 94, 0.08);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.2);
        }
        
        /* Source Bar Container and Tooltip for clutter-free table */
        .source-bar-container {
          cursor: pointer;
        }
        .source-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-8px);
          background: var(--color-surface, #fff);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-lg);
          border-radius: 8px;
          padding: 8px 12px;
          z-index: 100;
          width: 220px;
          visibility: hidden;
          opacity: 0;
          transition: all 0.2s ease;
          pointer-events: none;
        }
        .source-bar-container:hover .source-tooltip {
          visibility: visible;
          opacity: 1;
          transform: translateX(-50%) translateY(-4px);
        }
        .source-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 6px;
          border-style: solid;
          border-color: var(--color-surface, #fff) transparent transparent transparent;
        }
      `}</style>
    </div>
  );
};
