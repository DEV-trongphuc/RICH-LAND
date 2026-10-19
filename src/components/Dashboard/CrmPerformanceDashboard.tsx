import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, TrendingUp, Award, Flame, Filter, Layers, Building2,
  CheckCircle2, PhoneCall, Handshake, DollarSign, Percent,
  BarChart2, PieChart as PieChartIcon, Search, RefreshCw, Briefcase, Zap, GitBranch
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, LabelList
} from 'recharts';
import { CustomSelect } from '../ui/CustomSelect';
import { Avatar } from '../ui/Avatar';
import { fetchAPI } from '../../utils/api';
import { KpiCardSkeleton, Skeleton } from '../ui/Skeleton';

export type DashboardSubTab = 'sale_perf' | 'mkt_perf' | 'revenue' | 'distribution';

interface CrmPerformanceDashboardProps {
  activeSubTab: DashboardSubTab;
  isSaleOnly: boolean;
  dateFilter: string;
  isActive: boolean;
  theme: 'light' | 'dark';
  isMobile: boolean;
}

const CHART_COLORS = [
  '#a31422',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#64748b'
];

function resolveDateRangeFromFilter(dateFilter: string): { start_date: string; end_date: string } {
  if (!dateFilter || dateFilter === 'Tất cả' || dateFilter === 'all') {
    return { start_date: '', end_date: '' };
  }

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dateFilter.includes('đến')) {
    const parts = dateFilter.split(/đến/i).map(s => s.trim());
    const parsePart = (str: string) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
      return '';
    };
    return {
      start_date: parsePart(parts[0] || ''),
      end_date: parsePart(parts[1] || '')
    };
  }

  switch (dateFilter) {
    case 'Hôm nay':
      return { start_date: fmt(today), end_date: fmt(today) };
    case 'Hôm qua': {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      return { start_date: fmt(yest), end_date: fmt(yest) };
    }
    case '7 ngày qua': {
      const d7 = new Date(today);
      d7.setDate(d7.getDate() - 6);
      return { start_date: fmt(d7), end_date: fmt(today) };
    }
    case '30 ngày qua': {
      const d30 = new Date(today);
      d30.setDate(d30.getDate() - 29);
      return { start_date: fmt(d30), end_date: fmt(today) };
    }
    case 'Tuần này': {
      const dayOfWeek = today.getDay() || 7;
      const mon = new Date(today);
      mon.setDate(today.getDate() - dayOfWeek + 1);
      return { start_date: fmt(mon), end_date: fmt(today) };
    }
    case 'Tuần trước': {
      const dayOfWeek = today.getDay() || 7;
      const lastSun = new Date(today);
      lastSun.setDate(today.getDate() - dayOfWeek);
      const lastMon = new Date(lastSun);
      lastMon.setDate(lastSun.getDate() - 6);
      return { start_date: fmt(lastMon), end_date: fmt(lastSun) };
    }
    case 'Tuần trước nữa': {
      const dayOfWeek = today.getDay() || 7;
      const sun2 = new Date(today);
      sun2.setDate(today.getDate() - dayOfWeek - 7);
      const mon2 = new Date(sun2);
      mon2.setDate(sun2.getDate() - 6);
      return { start_date: fmt(mon2), end_date: fmt(sun2) };
    }
    case 'Tháng này': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start_date: fmt(firstDay), end_date: fmt(today) };
    }
    case 'Tháng trước': {
      const firstLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start_date: fmt(firstLastMonth), end_date: fmt(lastLastMonth) };
    }
    default:
      return { start_date: '', end_date: '' };
  }
}

const formatVND = (val: number) => {
  if (!val || isNaN(val)) return '0 ₫';
  return Math.round(val).toLocaleString('vi-VN') + ' ₫';
};

const formatCompactVND = (val: number) => {
  if (!val || isNaN(val)) return '0 ₫';
  if (val >= 1_000_000_000) {
    return (val / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + ' tỷ';
  }
  if (val >= 1_000_000) {
    return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr';
  }
  return Math.round(val).toLocaleString('vi-VN') + ' ₫';
};

const WatermarkDecor: React.FC<{ color: string; variant?: 'network' | 'user' | 'alert' | 'bolt' }> = ({
  color,
  variant = 'network'
}) => (
  <div className="decor-svg" style={{ color }}>
    {variant === 'network' && (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <circle cx="30" cy="50" r="10" stroke="currentColor" strokeWidth="2" />
        <circle cx="70" cy="30" r="10" stroke="currentColor" strokeWidth="2" />
        <circle cx="70" cy="70" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M40 50 H 55 V 30 H 60 M 55 50 V 70 H 60" stroke="currentColor" strokeWidth="2" />
      </svg>
    )}
    {variant === 'user' && (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <circle cx="45" cy="35" r="15" stroke="currentColor" strokeWidth="2" />
        <path d="M20 75 C 20 60, 31 50, 45 50 C 59 50, 70 60, 70 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M75 35 H 89 M 82 28 V 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )}
    {variant === 'alert' && (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <path d="M50 20 L 85 80 H 15 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M50 40 V 55 M 50 67 H 50.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )}
    {variant === 'bolt' && (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <path d="M55 15 L 25 55 H 50 L 45 85 L 75 45 H 50 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    )}
  </div>
);

interface NativeKpiCardItem {
  id: string;
  label: string;
  value: string | number;
  color: string;
  iconBg: string;
  icon: any;
  decor: 'network' | 'user' | 'alert' | 'bolt';
  dots: Array<{ color: string; text: string }>;
  footerText: string;
  footerHighlight?: string;
}

const NativeStatCardGrid: React.FC<{ cards: NativeKpiCardItem[] }> = ({ cards }) => (
  <div
    className="dashboard-kpi-grid"
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '1rem',
      marginBottom: '1.25rem'
    }}
  >
    {cards.map((card, idx) => {
      const Icon = card.icon;
      return (
        <div
          key={card.id}
          className="stat-card hover-lift"
          style={{
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.4s ease-out both',
            animationDelay: `${100 + idx * 40}ms`,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}
        >
          <WatermarkDecor color={card.color} variant={card.decor} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span
              className="stat-label"
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                fontSize: '0.75rem'
              }}
            >
              {card.label}
            </span>
            <div
              className="stat-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: card.iconBg,
                color: card.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Icon size={16} />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)' }}>
              {card.value}
            </div>

            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                marginTop: '4px',
                marginBottom: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              {card.dots.map((d, dIdx) => (
                <span key={dIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: d.color,
                      display: 'inline-block',
                      flexShrink: 0
                    }}
                  />
                  <span>{d.text}</span>
                </span>
              ))}
            </div>

            <div
              className="stat-change up"
              style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: card.color
              }}
            >
              <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 5l9 14H3z" />
              </svg>
              {card.footerHighlight && <span>{card.footerHighlight}</span>}
              <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '2px', fontWeight: 500 }}>
                {card.footerText}
              </span>
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

const DonutCardWithCustomLegend: React.FC<{
  title: string;
  subtitle?: string;
  icon: any;
  iconColor: string;
  data: Array<{ name: string; value: number; count?: number; color?: string }>;
  centerValue: string | number;
  centerLabel: string;
  unitLabel?: string;
  isCurrency?: boolean;
}> = ({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  data,
  centerValue,
  centerLabel,
  unitLabel = 'lead',
  isCurrency = false
}) => {
  const normalized = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number; color?: string }>();
    (data || []).forEach(item => {
      const key = String(item.name || 'Khác').trim() || 'Khác';
      const val = Number(item.value || 0);
      const cnt = Number(item.count ?? item.value ?? 0);
      if (val <= 0 && cnt <= 0) return;
      const existing = map.get(key);
      if (existing) {
        existing.value += val;
        existing.count += cnt;
      } else {
        map.set(key, { name: key, value: val > 0 ? val : cnt, count: cnt, color: item.color });
      }
    });
    const arr = Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 8);
    return arr.map((it, idx) => ({
      ...it,
      color: it.color || CHART_COLORS[idx % CHART_COLORS.length]
    }));
  }, [data]);

  const totalVal = useMemo(() => normalized.reduce((s, x) => s + x.value, 0), [normalized]);

  return (
    <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
            <Icon size={18} color={iconColor} /> {title}
          </h3>
          {subtitle && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {normalized.length > 0 && totalVal > 0 ? (
          <>
            <div style={{ width: '100%', height: 175, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={normalized}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {normalized.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      isCurrency ? formatVND(Number(val)) : `${Number(val).toLocaleString('vi-VN')} ${unitLabel}`,
                      name
                    ]}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                    itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div
                style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {centerValue}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {centerLabel}
                </span>
              </div>
            </div>

            {/* Custom Legend matching Dashboard.tsx L2196-2221 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '8px 12px',
                width: '100%',
                marginTop: '12px',
                padding: '0 6px',
                fontSize: '0.75rem',
                color: 'var(--color-text-light)'
              }}
            >
              {normalized.map((entry, index) => {
                const pct = totalVal > 0 ? Math.round((entry.value / totalVal) * 100) : 0;
                return (
                  <div
                    key={index}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
                    title={`${entry.name}: ${isCurrency ? formatVND(entry.value) : entry.value}`}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--color-text)' }}>
                      {entry.name}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 600, flexShrink: 0 }}>
                      {isCurrency ? formatCompactVND(entry.value) : `${entry.value}`} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.825rem' }}>
            Chưa có dữ liệu thống kê
          </div>
        )}
      </div>
    </div>
  );
};

export const CrmPerformanceDashboard: React.FC<CrmPerformanceDashboardProps> = ({
  activeSubTab,
  isSaleOnly,
  dateFilter,
  isActive,
  theme,
  isMobile
}) => {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);

  // Filters
  const [selectedSaleId, setSelectedSaleId] = useState<string>('all');
  const [careRole, setCareRole] = useState<'all' | 'primary' | 'coop'>('all');
  const [leadSourceType, setLeadSourceType] = useState<'all' | 'distributed' | 'databank' | 'personal'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [selectedPhanLoai, setSelectedPhanLoai] = useState<string>('all');
  const [selectedDonvi, setSelectedDonvi] = useState<string>('all');
  const [tableSearch, setTableSearch] = useState<string>('');

  const reqIdRef = useRef(0);

  const dateRange = useMemo(() => resolveDateRangeFromFilter(dateFilter), [dateFilter]);

  const fetchTabMetrics = async (signal?: AbortSignal) => {
    if (activeSubTab === 'distribution') return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tab', activeSubTab);
      if (dateRange.start_date) params.set('start_date', dateRange.start_date);
      if (dateRange.end_date) params.set('end_date', dateRange.end_date);
      if (selectedProjectId !== 'all') params.set('project_id', selectedProjectId);
      if (selectedCampaignId !== 'all') params.set('campaign_id', selectedCampaignId);
      if (!isSaleOnly && selectedSaleId !== 'all') params.set('sale_id', selectedSaleId);
      if (careRole !== 'all') params.set('care_role', careRole);
      if (leadSourceType !== 'all') params.set('lead_source_type', leadSourceType);
      if (selectedPhanLoai !== 'all') params.set('lead_phan_loai', selectedPhanLoai);
      if (selectedDonvi !== 'all') params.set('donvi_chay', selectedDonvi);

      const res = await fetchAPI(`get_crm_dashboard_v2&${params.toString()}`, { signal });
      if (signal?.aborted || reqId !== reqIdRef.current) return;
      if (res && res.success) {
        setPayload(res);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Error loading dashboard v2:', e);
      }
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!isActive || activeSubTab === 'distribution') return;
    const controller = new AbortController();
    fetchTabMetrics(controller.signal);
    return () => controller.abort();
  }, [
    isActive,
    activeSubTab,
    dateRange.start_date,
    dateRange.end_date,
    selectedSaleId,
    careRole,
    leadSourceType,
    selectedProjectId,
    selectedCampaignId,
    selectedPhanLoai,
    selectedDonvi
  ]);

  const filterOptions = payload?.filter_options || {
    projects: [],
    sale_campaigns: [],
    mkt_campaigns: [],
    sales_users: [],
    donvi_list: [],
    phan_loai_list: []
  };

  const projectOptions = useMemo(() => [
    { value: 'all', label: activeSubTab === 'mkt_perf' ? 'Tất cả Dự án gốc (MKT)' : 'Tất cả Dự án chăm sóc' },
    ...(filterOptions.projects || []).map((p: any) => ({
      value: String(p.id),
      label: p.name
    }))
  ], [filterOptions.projects, activeSubTab]);

  const campaignOptions = useMemo(() => {
    const rawList = activeSubTab === 'mkt_perf'
      ? (filterOptions.mkt_campaigns || [])
      : (filterOptions.sale_campaigns || []);
    const filtered = selectedProjectId !== 'all'
      ? rawList.filter((c: any) => !c.project_id || String(c.project_id) === String(selectedProjectId) || String(c.id) === String(selectedCampaignId))
      : rawList;
    return [
      { value: 'all', label: activeSubTab === 'mkt_perf' ? 'Tất cả Chiến dịch gốc (Leads)' : 'Tất cả Chiến dịch chăm sóc' },
      ...filtered.map((c: any) => ({
        value: String(c.id),
        label: String(c.name || c.id)
      }))
    ];
  }, [filterOptions.mkt_campaigns, filterOptions.sale_campaigns, activeSubTab, selectedProjectId, selectedCampaignId]);

  const saleUserOptions = useMemo(() => [
    { value: 'all', label: 'Toàn bộ nhân sự Sale' },
    ...(filterOptions.sales_users || []).map((u: any) => ({
      value: String(u.id),
      label: u.name || 'Sale',
      sublabel: u.team_name || u.email || undefined,
      avatar: u.avatar || undefined
    }))
  ], [filterOptions.sales_users]);

  const phanLoaiOptions = useMemo(() => [
    { value: 'all', label: 'Tất cả Phân loại Lead' },
    ...(filterOptions.phan_loai_list || []).map((pl: string) => ({
      value: pl,
      label: pl
    }))
  ], [filterOptions.phan_loai_list]);

  const donviOptions = useMemo(() => [
    { value: 'all', label: 'Tất cả Đơn vị chạy' },
    ...(filterOptions.donvi_list || []).map((dv: string) => ({
      value: dv,
      label: dv
    }))
  ], [filterOptions.donvi_list]);

  const resetFilters = () => {
    setSelectedSaleId('all');
    setCareRole('all');
    setLeadSourceType('all');
    setSelectedProjectId('all');
    setSelectedCampaignId('all');
    setSelectedPhanLoai('all');
    setSelectedDonvi('all');
    setTableSearch('');
  };

  const kpis = payload?.kpis || {};
  const funnel = payload?.funnel || { rates: {} };
  const rates = funnel.rates || {};

  // ===========================================================================
  // RENDER FILTER BAR (Unified with Dashboard.tsx card & segmented button pills)
  // ===========================================================================
  const renderFilterBar = () => (
    <div
      className="card"
      style={{
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        animation: 'slideUp 0.35s ease-out both'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '10px',
          paddingBottom: '12px',
          marginBottom: '12px',
          borderBottom: '1px solid var(--color-border-light)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(163, 20, 34, 0.08)',
              color: '#a31422',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            <Filter size={13} />
            {activeSubTab === 'sale_perf' && (isSaleOnly ? 'Hiệu Quả Cá Nhân & Hợp Tác' : 'Bộ Lọc Hiệu Quả Sale (Theo Dự án & Chiến dịch Chăm Sóc)')}
            {activeSubTab === 'mkt_perf' && 'Bộ Lọc Hiệu Quả MKT (Độc lập theo Dự án & Chiến dịch Gốc trên Leads)'}
            {activeSubTab === 'revenue' && 'Bộ Lọc Doanh Thu & Giao Dịch'}
          </span>

          {activeSubTab === 'sale_perf' && (
            <div
              style={{
                display: 'flex',
                background: 'var(--color-bg)',
                padding: '3px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)',
                flexWrap: 'wrap'
              }}
            >
              {[
                { id: 'all', label: 'Tất cả vai trò' },
                { id: 'primary', label: 'Chăm chính' },
                { id: 'coop', label: 'Hợp tác (Đồng chăm sóc)' }
              ].map(item => {
                const active = careRole === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCareRole(item.id as any)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: active ? 'var(--color-surface)' : 'transparent',
                      color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeSubTab === 'sale_perf' && (
            <div
              style={{
                display: 'flex',
                background: 'var(--color-bg)',
                padding: '3px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)',
                flexWrap: 'wrap'
              }}
            >
              {[
                { id: 'all', label: 'Tất cả nguồn' },
                { id: 'distributed', label: 'Khách được chia' },
                { id: 'databank', label: 'Kho Databank' },
                { id: 'personal', label: 'Cá nhân / Giới thiệu' }
              ].map(item => {
                const active = leadSourceType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLeadSourceType(item.id as any)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: active ? 'var(--color-surface)' : 'transparent',
                      color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={resetFilters}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            border: '1px solid var(--color-border-light)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={12} />
          Đặt lại bộ lọc
        </button>
      </div>

      {/* Dropdown Selectors Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px'
        }}
      >
        {!isSaleOnly && activeSubTab !== 'mkt_perf' && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Nhân sự Sale (Tìm kiếm tên)
            </div>
            <CustomSelect
              options={saleUserOptions}
              value={selectedSaleId}
              onChange={(val) => setSelectedSaleId(String(val))}
              searchable={true}
              showAvatars={true}
              placeholder="Chọn nhân sự Sale..."
              width="100%"
            />
          </div>
        )}

        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            {activeSubTab === 'mkt_perf' ? 'Dự án gốc (MKT)' : 'Dự án chăm sóc (Sale)'}
          </div>
          <CustomSelect
            options={projectOptions}
            value={selectedProjectId}
            onChange={(val) => {
              setSelectedProjectId(String(val));
              setSelectedCampaignId('all');
            }}
            searchable={true}
            width="100%"
          />
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            {activeSubTab === 'mkt_perf' ? 'Chiến dịch gốc (Bảng Leads)' : 'Chiến dịch chăm sóc (Sale)'}
          </div>
          <CustomSelect
            options={campaignOptions}
            value={selectedCampaignId}
            onChange={(val) => setSelectedCampaignId(String(val))}
            searchable={true}
            width="100%"
          />
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
            Phân loại Lead
          </div>
          <CustomSelect
            options={phanLoaiOptions}
            value={selectedPhanLoai}
            onChange={(val) => setSelectedPhanLoai(String(val))}
            searchable={true}
            width="100%"
          />
        </div>

        {activeSubTab !== 'sale_perf' && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Đơn vị triển khai
            </div>
            <CustomSelect
              options={donviOptions}
              value={selectedDonvi}
              onChange={(val) => setSelectedDonvi(String(val))}
              searchable={true}
              width="100%"
            />
          </div>
        )}
      </div>
    </div>
  );

  // ===========================================================================
  // SKELETON LOADING STATE
  // ===========================================================================
  if (loading && !payload) {
    return (
      <div>
        {renderFilterBar()}
        <div
          className="dashboard-kpi-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
        <div
          className="responsive-grid-6-4"
          style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr', gap: '1.25rem', marginBottom: '1.25rem' }}
        >
          <div className="card" style={{ padding: '1.25rem' }}>
            <Skeleton width={220} height={18} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={240} borderRadius={12} />
          </div>
          <div className="card" style={{ padding: '1.25rem' }}>
            <Skeleton width={180} height={18} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={240} borderRadius={12} />
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // TAB 1: HIỆU QUẢ SALE (`sale_perf`)
  // ===========================================================================
  if (activeSubTab === 'sale_perf') {
    const staffRows = (payload?.staff_table || []).filter((r: any) => {
      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase();
      return (
        String(r.sale_name || '').toLowerCase().includes(q) ||
        String(r.sale_email || '').toLowerCase().includes(q) ||
        String(r.team_name || '').toLowerCase().includes(q)
      );
    });

    const saleKpiCards: NativeKpiCardItem[] = [
      {
        id: 'sale-total',
        label: 'TỔNG LEAD CHĂM SÓC',
        value: Number(kpis.total_leads || 0).toLocaleString('vi-VN'),
        color: '#a31422',
        iconBg: 'rgba(163, 20, 34, 0.08)',
        icon: Users,
        decor: 'network',
        dots: [
          { color: '#a31422', text: `Được chia: ${kpis.distributed_leads || 0}` },
          { color: '#3b82f6', text: `Kho: ${kpis.databank_leads || 0}` },
          { color: '#10b981', text: `Cá nhân: ${kpis.personal_leads || 0}` }
        ],
        footerHighlight: `${kpis.coop_leads || 0} hợp tác`,
        footerText: `• ${kpis.primary_leads || 0} chăm chính`
      },
      {
        id: 'sale-ql',
        label: 'QUALIFIED LEAD (QL)',
        value: Number(kpis.ql_count || 0).toLocaleString('vi-VN'),
        color: '#3b82f6',
        iconBg: 'rgba(59, 130, 246, 0.08)',
        icon: CheckCircle2,
        decor: 'user',
        dots: [
          { color: '#10b981', text: `Tỉ lệ QL: ${kpis.ql_rate || 0}%` },
          { color: '#ef4444', text: `Not Lead: ${kpis.not_lead_count || 0}` }
        ],
        footerHighlight: `${kpis.ql_rate || 0}%`,
        footerText: 'tỉ lệ đạt chuẩn trên tổng Lead'
      },
      {
        id: 'sale-mql',
        label: 'QUAN TÂM & ĐỒNG Ý GẶP',
        value: Number(kpis.m_ql_count || 0).toLocaleString('vi-VN'),
        color: '#f59e0b',
        iconBg: 'rgba(245, 158, 11, 0.08)',
        icon: PhoneCall,
        decor: 'alert',
        dots: [
          { color: '#f59e0b', text: `M_QL (Quan tâm): ${kpis.m_ql_count || 0}` },
          { color: '#8b5cf6', text: `Đồng ý gặp: ${kpis.dong_y_gap_count || 0}` }
        ],
        footerHighlight: `${rates.tuong_tac_lan_1 || 0}%`,
        footerText: 'tương tác lần 1 (M_QL / Tổng Lead)'
      },
      {
        id: 'sale-sql-gd',
        label: 'ĐÃ GẶP (S_QL) & GIAO DỊCH',
        value: `${Number(kpis.giao_dich_count || 0).toLocaleString('vi-VN')} chốt`,
        color: '#10b981',
        iconBg: 'rgba(16, 185, 129, 0.08)',
        icon: Award,
        decor: 'bolt',
        dots: [
          { color: '#06b6d4', text: `Đã gặp (S_QL): ${kpis.s_ql_count || 0}` },
          { color: '#f59e0b', text: `Booking: ${kpis.booking_count || 0}` },
          { color: '#10b981', text: `Đặt cọc: ${kpis.dat_coc_count || 0}` }
        ],
        footerHighlight: `Tỉ lệ chốt ${rates.ti_le_chot || 0}%`,
        footerText: `• Đốt lửa ${rates.ti_le_dot_lua || 0}% • CĐ chung ${rates.chuyen_doi_chung || 0}%`
      }
    ];

    const funnelSteps = [
      { label: '1. Tổng Lead được chia', val: funnel.total_leads || 0, color: '#334155', pct: 100 },
      { label: '2. Qualified Lead (QL)', val: funnel.ql_count || 0, color: '#3b82f6', pct: funnel.total_leads > 0 ? Math.round((funnel.ql_count / funnel.total_leads) * 100) : 0 },
      { label: '3. Quan tâm (M_QL)', val: funnel.m_ql_count || 0, color: '#f59e0b', pct: funnel.total_leads > 0 ? Math.round((funnel.m_ql_count / funnel.total_leads) * 100) : 0 },
      { label: '4. Đồng ý gặp', val: funnel.dong_y_gap_count || 0, color: '#8b5cf6', pct: funnel.total_leads > 0 ? Math.round((funnel.dong_y_gap_count / funnel.total_leads) * 100) : 0 },
      { label: '5. Đã gặp (S_QL)', val: funnel.s_ql_count || 0, color: '#06b6d4', pct: funnel.total_leads > 0 ? Math.round((funnel.s_ql_count / funnel.total_leads) * 100) : 0 },
      { label: '6. Giao dịch (Booking + Cọc)', val: funnel.giao_dich_count || 0, color: '#a31422', pct: funnel.total_leads > 0 ? Math.round((funnel.giao_dich_count / funnel.total_leads) * 100) : 0 }
    ];

    return (
      <div>
        {renderFilterBar()}
        <NativeStatCardGrid cards={saleKpiCards} />

        {/* Row 1: Conversion Funnel (6fr) + Temperature Donut (4fr) */}
        <div
          className="responsive-grid-6-4"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr',
            gap: '1.25rem',
            marginBottom: '1.25rem'
          }}
        >
          <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '8px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                  <Zap size={18} color="#a31422" /> Phễu Chuyển Đổi & Tỉ Lệ Chốt
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                  {funnel.note || 'Chỉ tính trên khách hàng được chia (không tính khách lấy từ Kho Databank)'}
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: 'rgba(163, 20, 34, 0.08)',
                  color: '#a31422'
                }}
              >
                Mẫu số: {Number(funnel.total_leads || 0).toLocaleString('vi-VN')} leads được chia
              </span>
            </div>

            {/* 4 Conversion Rate Highlights */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: '10px',
                marginBottom: '1.25rem'
              }}
            >
              {[
                { label: 'Tương tác lần 1', val: `${rates.tuong_tac_lan_1 || 0}%`, formula: 'M_QL / Tổng Lead', color: '#3b82f6' },
                { label: 'Tỉ lệ đốt lửa', val: `${rates.ti_le_dot_lua || 0}%`, formula: 'S_QL / M_QL', color: '#f59e0b' },
                { label: 'Tỉ lệ chốt', val: `${rates.ti_le_chot || 0}%`, formula: 'Giao dịch / S_QL', color: '#10b981' },
                { label: 'Chuyển đổi chung', val: `${rates.chuyen_doi_chung || 0}%`, formula: 'Giao dịch / QL', color: '#a31422' }
              ].map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border-light)'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{m.label}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: m.color, margin: '2px 0' }}>{m.val}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-light)' }}>{m.formula}</div>
                </div>
              ))}
            </div>

            {/* Progress Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {funnelSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: isMobile ? '130px' : '175px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', flexShrink: 0 }}>
                    {step.label}
                  </div>
                  <div style={{ flex: 1, height: '10px', background: 'var(--color-bg)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(step.val > 0 ? 3 : 0, Math.min(100, step.pct))}%`,
                        height: '100%',
                        background: step.color,
                        borderRadius: '5px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                  <div style={{ width: '95px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>
                    {Number(step.val).toLocaleString('vi-VN')}{' '}
                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>({step.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DonutCardWithCustomLegend
            title="Tỉ Trọng Nhiệt Độ Khách Hàng"
            subtitle="Phân bổ Nóng • Ấm • Lạnh trên tập khách đang lọc"
            icon={Flame}
            iconColor="#a31422"
            data={payload?.temperature_chart || []}
            centerValue={Number(kpis.total_leads || 0).toLocaleString('vi-VN')}
            centerLabel="Tổng KH"
          />
        </div>

        {/* Row 2: Timeline Chart (6fr) + Care Project Progress List (4fr) */}
        <div
          className="responsive-grid-6-4"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr',
            gap: '1.25rem',
            marginBottom: '1.25rem'
          }}
        >
          <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <BarChart2 size={18} color="#3b82f6" /> Biểu Đồ Xu Hướng Lead & Chuyển Đổi
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Số lượng Tổng Lead, M_QL (Quan tâm), S_QL (Đã gặp) và Tỉ lệ QL (%)
              </p>
            </div>
            {(payload?.timeline_chart || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={payload.timeline_chart} margin={{ left: -10, right: 5, top: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={40} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#10b981' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar yAxisId="left" dataKey="total_leads" name="Tổng Lead" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar yAxisId="left" dataKey="m_ql" name="M_QL (Quan tâm)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar yAxisId="left" dataKey="s_ql" name="S_QL (Đã gặp)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Line yAxisId="right" type="monotone" dataKey="ql_rate" name="Tỉ lệ QL (%)" stroke="#a31422" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                Chưa có dữ liệu thống kê
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <Building2 size={18} color="#a31422" /> Tỉ Trọng Theo Dự Án Chăm Sóc
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Tính theo Dự án Sale đang chăm sóc trên hồ sơ khách hàng
              </p>
            </div>
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
              {(payload?.by_project_chart || []).length > 0 ? (
                (() => {
                  const list = payload.by_project_chart;
                  const maxVal = Math.max(1, ...list.map((x: any) => Number(x.value || 0)));
                  return list.map((p: any, idx: number) => {
                    const pct = Math.round((Number(p.value || 0) / maxVal) * 100);
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem', fontWeight: 600 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', width: 18 }}>#{idx + 1}</span>
                            <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.name}
                            </span>
                          </span>
                          <span style={{ color: 'var(--color-text)', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                            {p.value} lead <span style={{ fontSize: '0.72rem', color: '#10b981' }}>({p.giao_dich || 0} chốt)</span>
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden', marginLeft: 26 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                  Chưa có dữ liệu dự án
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Staff Comparison Table with Avatar (Exact Dashboard.tsx L1862-1962 style) */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: '12px',
              marginBottom: '1.25rem'
            }}
          >
            <div>
              <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <Users size={18} color="var(--color-primary)" /> Bảng So Sánh Hiệu Quả Chăm Sóc & Chuyển Đổi Theo Sale
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Đo lường theo Dự án & Chiến dịch Sale đang chăm sóc (Tỉ lệ chuyển đổi tính trên khách được chia)
              </p>
            </div>

            {/* Clean Flex Search Box — Zero Icon Overlap */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                minWidth: isMobile ? '100%' : '260px'
              }}
            >
              <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Tìm nhanh tên nhân sự hoặc team..."
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text)'
                }}
              />
            </div>
          </div>

          <div
            className="custom-scrollbar"
            style={{
              overflowX: 'auto',
              maxHeight: '440px',
              overflowY: 'auto',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              background: 'var(--color-surface)'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', minWidth: '1150px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Nhân viên Sale</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Tổng Lead</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Được chia / Kho / HT</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Not Lead</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>QL (%)</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>M_QL</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Đồng ý gặp</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>S_QL (Đã gặp)</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Giao dịch</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Nóng / Ấm / Lạnh</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>TT Lần 1</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Đốt Lửa</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Tỉ Lệ Chốt</th>
                </tr>
              </thead>
              <tbody>
                {staffRows.length > 0 ? (
                  staffRows.map((row: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '52px' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar src={row.sale_avatar} name={row.sale_name || 'Sale'} size={30} />
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{row.sale_name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                              {row.team_name && row.team_name !== '—' ? row.team_name : (row.sale_email || 'Chưa gắn team')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--color-text)' }}>
                        {row.total_leads}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 600 }}>
                        <span title="Khách được chia" style={{ color: 'var(--color-text)' }}>{row.distributed_leads}</span>
                        {' / '}
                        <span title="Kho Databank" style={{ color: '#3b82f6' }}>{row.databank_leads}</span>
                        {' / '}
                        <span title="Hợp tác" style={{ color: '#8b5cf6' }}>{row.coop_leads}</span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>
                        {row.not_lead_count}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{row.ql_count}</span>{' '}
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981'
                          }}
                        >
                          {row.ql_rate}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#d97706' }}>
                        {row.m_ql_count}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#8b5cf6' }}>
                        {row.dong_y_gap_count}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#0891b2' }}>
                        {row.s_ql_count}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            background: row.giao_dich_count > 0 ? 'rgba(163, 20, 34, 0.1)' : 'var(--color-bg)',
                            color: row.giao_dich_count > 0 ? '#a31422' : 'var(--color-text-muted)'
                          }}
                        >
                          {row.giao_dich_count}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.78rem', fontWeight: 700 }}>
                        <span style={{ color: '#a31422' }}>{row.temp_hot}</span>
                        {' / '}
                        <span style={{ color: '#f59e0b' }}>{row.temp_warm}</span>
                        {' / '}
                        <span style={{ color: '#3b82f6' }}>{row.temp_cold}</span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb' }}>
                          {row.rates?.tuong_tac_lan_1 || 0}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.08)', color: '#d97706' }}>
                          {row.rates?.ti_le_dot_lua || 0}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                          {row.rates?.ti_le_chot || 0}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                      Không có dữ liệu nhân sự phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // TAB 2: HIỆU QUẢ MKT (`mkt_perf`)
  // ===========================================================================
  if (activeSubTab === 'mkt_perf') {
    const campaignRows = (payload?.by_campaign_table || []).filter((r: any) => {
      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase();
      return (
        String(r.campaign_name || '').toLowerCase().includes(q) ||
        String(r.campaign_id || '').toLowerCase().includes(q) ||
        String(r.project_name || '').toLowerCase().includes(q) ||
        String(r.donvi_chay || '').toLowerCase().includes(q)
      );
    });

    const mktKpiCards: NativeKpiCardItem[] = [
      {
        id: 'mkt-total',
        label: 'TỔNG LEAD GỐC (MKT)',
        value: Number(kpis.total_leads || 0).toLocaleString('vi-VN'),
        color: '#a31422',
        iconBg: 'rgba(163, 20, 34, 0.08)',
        icon: Layers,
        decor: 'network',
        dots: [
          { color: '#a31422', text: `Bảng Leads: ${kpis.total_leads || 0}` },
          { color: '#64748b', text: `CS Dài hạn: ${kpis.cham_soc_dai_han_count || 0}` }
        ],
        footerHighlight: '100% Độc lập',
        footerText: 'theo Dự án & Chiến dịch gốc MKT'
      },
      {
        id: 'mkt-ql',
        label: 'QUALIFIED LEAD (QL)',
        value: Number(kpis.ql_count || 0).toLocaleString('vi-VN'),
        color: '#3b82f6',
        iconBg: 'rgba(59, 130, 246, 0.08)',
        icon: CheckCircle2,
        decor: 'user',
        dots: [
          { color: '#10b981', text: `Tỉ lệ QL: ${kpis.ql_rate || 0}%` },
          { color: '#ef4444', text: `Not Lead: ${kpis.not_lead_count || 0}` }
        ],
        footerHighlight: `${kpis.ql_rate || 0}%`,
        footerText: 'tỉ lệ Lead đạt chuẩn MKT'
      },
      {
        id: 'mkt-mql',
        label: 'M_QL (QUAN TÂM) & HẸN GẶP',
        value: Number(kpis.m_ql_count || 0).toLocaleString('vi-VN'),
        color: '#f59e0b',
        iconBg: 'rgba(245, 158, 11, 0.08)',
        icon: PhoneCall,
        decor: 'alert',
        dots: [
          { color: '#f59e0b', text: `M_QL: ${kpis.m_ql_count || 0}` },
          { color: '#8b5cf6', text: `Đồng ý gặp: ${kpis.dong_y_gap_count || 0}` }
        ],
        footerHighlight: `${rates.tuong_tac_lan_1 || 0}%`,
        footerText: 'tương tác lần 1 (M_QL / Tổng Lead)'
      },
      {
        id: 'mkt-sql-gd',
        label: 'ĐÃ GẶP (S_QL) & GIAO DỊCH',
        value: `${Number(kpis.giao_dich_count || 0).toLocaleString('vi-VN')} chốt`,
        color: '#10b981',
        iconBg: 'rgba(16, 185, 129, 0.08)',
        icon: Award,
        decor: 'bolt',
        dots: [
          { color: '#06b6d4', text: `Đã gặp (S_QL): ${kpis.s_ql_count || 0}` },
          { color: '#10b981', text: `Giao dịch: ${kpis.giao_dich_count || 0}` }
        ],
        footerHighlight: `Tỉ lệ chốt ${rates.ti_le_chot || 0}%`,
        footerText: `• Đốt lửa ${rates.ti_le_dot_lua || 0}% • CĐ chung ${rates.chuyen_doi_chung || 0}%`
      }
    ];

    return (
      <div>
        {renderFilterBar()}
        <NativeStatCardGrid cards={mktKpiCards} />

        {/* Row 1: MKT Timeline Chart (6fr) + Original Project Breakdown (4fr) */}
        <div
          className="responsive-grid-6-4"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr',
            gap: '1.25rem',
            marginBottom: '1.25rem'
          }}
        >
          <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <BarChart2 size={18} color="#a31422" /> Biểu Đồ Hiệu Quả Lead Marketing Theo Thời Gian
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Đo lường cố định trên bảng Leads gốc (Sale đổi dự án/chiến dịch không làm sai lệch số MKT)
              </p>
            </div>
            {(payload?.timeline_chart || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={payload.timeline_chart} margin={{ left: -10, right: 5, top: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={40} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#10b981' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar yAxisId="left" dataKey="total_leads" name="Tổng Lead" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar yAxisId="left" dataKey="ql" name="Qualified Lead (QL)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar yAxisId="left" dataKey="not_lead" name="Not Lead" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Line yAxisId="right" type="monotone" dataKey="ql_rate" name="Tỉ lệ QL (%)" stroke="#a31422" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                Chưa có dữ liệu thống kê
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <Building2 size={18} color="#a31422" /> Tỉ Trọng Lead Theo Dự Án Gốc (MKT)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Tính theo Dự án gốc từ chiến dịch Marketing
              </p>
            </div>
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
              {(payload?.by_project_chart || []).length > 0 ? (
                (() => {
                  const list = payload.by_project_chart;
                  const totalAll = Math.max(1, list.reduce((s: number, x: any) => s + Number(x.value || 0), 0));
                  const maxVal = Math.max(1, ...list.map((x: any) => Number(x.value || 0)));
                  return list.map((p: any, idx: number) => {
                    const barPct = Math.round((Number(p.value || 0) / maxVal) * 100);
                    const sharePct = Math.round((Number(p.value || 0) / totalAll) * 100);
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem', fontWeight: 600 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', width: 18 }}>#{idx + 1}</span>
                            <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.name}
                            </span>
                          </span>
                          <span style={{ color: 'var(--color-text)', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                            {Number(p.value).toLocaleString('vi-VN')} <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>({sharePct}%)</span>
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden', marginLeft: 26 }}>
                          <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                  Chưa có dữ liệu dự án
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: 3 Clean Donut Charts with Custom Legend (Zero Legend Overflow!) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '1.25rem',
            marginBottom: '1.25rem'
          }}
        >
          <DonutCardWithCustomLegend
            title="Tỉ Trọng Theo Phân Loại Lead"
            subtitle="Cơ cấu phân loại Lead MKT"
            icon={PieChartIcon}
            iconColor="#3b82f6"
            data={payload?.by_phan_loai_chart || []}
            centerValue={Number(kpis.total_leads || 0).toLocaleString('vi-VN')}
            centerLabel="Tổng Lead"
          />
          <DonutCardWithCustomLegend
            title="Tỉ Trọng Theo Kênh MKT"
            subtitle="Facebook Ads • Zalo • Google • Khác"
            icon={GitBranch}
            iconColor="#10b981"
            data={payload?.by_channel_chart || []}
            centerValue={(payload?.by_channel_chart || []).length}
            centerLabel="Kênh"
          />
          <DonutCardWithCustomLegend
            title="Tỉ Trọng Theo Đơn Vị Chạy"
            subtitle="Inhouse • Agency / Outsource"
            icon={Briefcase}
            iconColor="#f59e0b"
            data={payload?.by_donvi_chart || []}
            centerValue={(payload?.by_donvi_chart || []).length}
            centerLabel="Đơn vị"
          />
        </div>

        {/* Row 3: Campaign Attribution Table (`leads.campaign_id` / `leads.campaign_name`) */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: '12px',
              marginBottom: '1.25rem'
            }}
          >
            <div>
              <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <Layers size={18} color="#a31422" /> Bảng Đánh Giá Chi Tiết Theo Chiến Dịch Gốc (MKT)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Lọc & tổng hợp trực tiếp trên `leads.campaign_id` / `leads.campaign_name`
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                minWidth: isMobile ? '100%' : '260px'
              }}
            >
              <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Tìm chiến dịch, dự án, đơn vị..."
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text)'
                }}
              />
            </div>
          </div>

          <div
            className="custom-scrollbar"
            style={{
              overflowX: 'auto',
              maxHeight: '440px',
              overflowY: 'auto',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              background: 'var(--color-surface)'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', minWidth: '1100px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Chiến dịch gốc (MKT)</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Dự án gốc</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Đơn vị / Phân loại</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Tổng Lead</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Not Lead</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>QL (%)</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>M_QL</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Đồng ý gặp</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>S_QL</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Giao dịch</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>TT Lần 1</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Đốt Lửa</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Tỉ Lệ Chốt</th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.length > 0 ? (
                  campaignRows.map((row: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '50px' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{row.campaign_name}</div>
                        {row.campaign_id && row.campaign_id !== row.campaign_name && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>ID: {row.campaign_id}</div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text)' }}>{row.project_name}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.donvi_chay}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginLeft: 6 }}>• {row.lead_phan_loai}</span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--color-text)' }}>{row.total_leads}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{row.not_lead_count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700 }}>{row.ql_count}</span>{' '}
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                          {row.rates?.ql_rate || 0}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#d97706' }}>{row.m_ql_count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#8b5cf6' }}>{row.dong_y_gap_count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#0891b2' }}>{row.s_ql_count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem', background: row.giao_dich_count > 0 ? 'rgba(163, 20, 34, 0.1)' : 'var(--color-bg)', color: row.giao_dich_count > 0 ? '#a31422' : 'var(--color-text-muted)' }}>
                          {row.giao_dich_count}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb' }}>
                          {row.rates?.tuong_tac_lan_1 || 0}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.08)', color: '#d97706' }}>
                          {row.rates?.ti_le_dot_lua || 0}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                          {row.rates?.ti_le_chot || 0}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                      Không có dữ liệu chiến dịch phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // TAB 3: DOANH THU (`revenue`)
  // ===========================================================================
  if (activeSubTab === 'revenue') {
    const txRows = (payload?.transactions_table || []).filter((r: any) => {
      if (!tableSearch.trim()) return true;
      const q = tableSearch.toLowerCase();
      return (
        String(r.customer_name || '').toLowerCase().includes(q) ||
        String(r.customer_phone || '').toLowerCase().includes(q) ||
        String(r.project_name || '').toLowerCase().includes(q) ||
        String(r.sale_name || '').toLowerCase().includes(q) ||
        String(r.deposit_code || '').toLowerCase().includes(q)
      );
    });

    const revKpiCards: NativeKpiCardItem[] = [
      {
        id: 'rev-count',
        label: 'TỔNG SỐ GIAO DỊCH',
        value: Number(kpis.total_transactions || 0).toLocaleString('vi-VN'),
        color: '#a31422',
        iconBg: 'rgba(163, 20, 34, 0.08)',
        icon: Handshake,
        decor: 'network',
        dots: [
          { color: '#f59e0b', text: `Booking: ${kpis.booking_contacts || 0}` },
          { color: '#10b981', text: `Đặt cọc: ${kpis.dat_coc_contacts || 0}` }
        ],
        footerHighlight: `${kpis.total_transactions || 0} giao dịch`,
        footerText: 'ghi nhận trong hệ thống'
      },
      {
        id: 'rev-prop',
        label: 'TỔNG GIÁ TRỊ BĐS',
        value: formatCompactVND(Number(kpis.total_property_value || 0)),
        color: '#3b82f6',
        iconBg: 'rgba(59, 130, 246, 0.08)',
        icon: Building2,
        decor: 'user',
        dots: [
          { color: '#3b82f6', text: formatVND(Number(kpis.total_property_value || 0)) }
        ],
        footerHighlight: 'GMV Bất động sản',
        footerText: 'tổng giá trị sản phẩm giao dịch'
      },
      {
        id: 'rev-dep',
        label: 'TỔNG TIỀN CỌC / THANH TOÁN',
        value: formatCompactVND(Number(kpis.total_deposit_amount || 0)),
        color: '#f59e0b',
        iconBg: 'rgba(245, 158, 11, 0.08)',
        icon: DollarSign,
        decor: 'alert',
        dots: [
          { color: '#f59e0b', text: formatVND(Number(kpis.total_deposit_amount || 0)) }
        ],
        footerHighlight: 'Tiền cọc thực tế',
        footerText: 'ghi nhận trên phiếu cọc & hóa đơn'
      },
      {
        id: 'rev-comm',
        label: 'TỔNG DOANH THU / HOA HỒNG',
        value: formatCompactVND(Number(kpis.total_revenue_amount || 0)),
        color: '#10b981',
        iconBg: 'rgba(16, 185, 129, 0.08)',
        icon: TrendingUp,
        decor: 'bolt',
        dots: [
          { color: '#10b981', text: formatVND(Number(kpis.total_revenue_amount || 0)) }
        ],
        footerHighlight: 'Doanh thu kỳ vọng',
        footerText: 'tổng hợp theo Dự án & Sale'
      }
    ];

    // Map count as fallback metric when value is 0 so Donut charts always render proportions cleanly
    const mapChartItems = (arr: any[]) =>
      (arr || []).map((item: any) => ({
        name: item.name,
        value: Number(item.value || 0) > 0 ? Number(item.value) : Number(item.count || 0),
        count: Number(item.count || 0)
      }));

    const hasCurrencyValues = Number(kpis.total_revenue_amount || 0) > 0 || Number(kpis.total_property_value || 0) > 0;

    return (
      <div>
        {renderFilterBar()}
        <NativeStatCardGrid cards={revKpiCards} />

        {/* 2x2 Grid of Donut Charts matching Dashboard.tsx */}
        <div
          className="responsive-grid-1-1"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '1.25rem',
            marginBottom: '1.25rem'
          }}
        >
          <DonutCardWithCustomLegend
            title="Cơ Cấu Giao Dịch Theo Dự Án"
            subtitle="Phân bổ giao dịch & doanh thu theo Dự án"
            icon={Building2}
            iconColor="#a31422"
            data={mapChartItems(payload?.by_project_chart || [])}
            centerValue={hasCurrencyValues ? formatCompactVND(Number(kpis.total_revenue_amount || kpis.total_property_value || 0)) : `${kpis.total_transactions || 0} GD`}
            centerLabel={hasCurrencyValues ? 'Doanh thu' : 'Giao dịch'}
            unitLabel="GD"
            isCurrency={hasCurrencyValues}
          />
          <DonutCardWithCustomLegend
            title="Cơ Cấu Theo Phân Loại Lead"
            subtitle="Tỉ trọng giao dịch theo Phân loại Lead"
            icon={PieChartIcon}
            iconColor="#3b82f6"
            data={mapChartItems(payload?.by_phan_loai_chart || [])}
            centerValue={`${kpis.total_transactions || 0} GD`}
            centerLabel="Tổng GD"
            unitLabel="GD"
            isCurrency={hasCurrencyValues}
          />
          <DonutCardWithCustomLegend
            title="Cơ Cấu Theo Kênh Marketing"
            subtitle="Facebook Ads • Zalo • Databank • Cá nhân"
            icon={GitBranch}
            iconColor="#10b981"
            data={mapChartItems(payload?.by_channel_chart || [])}
            centerValue={(payload?.by_channel_chart || []).length}
            centerLabel="Kênh"
            unitLabel="GD"
            isCurrency={hasCurrencyValues}
          />
          <DonutCardWithCustomLegend
            title="Cơ Cấu Theo Đơn Vị Triển Khai"
            subtitle="Inhouse • Agency / Outsource"
            icon={Briefcase}
            iconColor="#f59e0b"
            data={mapChartItems(payload?.by_donvi_chart || [])}
            centerValue={(payload?.by_donvi_chart || []).length}
            centerLabel="Đơn vị"
            unitLabel="GD"
            isCurrency={hasCurrencyValues}
          />
        </div>

        {/* Transactions Table with Sale Avatar */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: '12px',
              marginBottom: '1.25rem'
            }}
          >
            <div>
              <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <DollarSign size={18} color="#10b981" /> Danh Sách Chi Tiết Giao Dịch (Booking & Đặt Cọc)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Tổng hợp toàn bộ giao dịch Đặt cọc & Booking theo bộ lọc hiện tại
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                minWidth: isMobile ? '100%' : '260px'
              }}
            >
              <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Tìm mã GD, khách hàng, dự án, Sale..."
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text)'
                }}
              />
            </div>
          </div>

          <div
            className="custom-scrollbar"
            style={{
              overflowX: 'auto',
              maxHeight: '440px',
              overflowY: 'auto',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              background: 'var(--color-surface)'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', minWidth: '1100px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Mã GD</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Khách hàng</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Dự án / Mã căn</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Sale phụ trách</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Chiến dịch / Nguồn</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'right' }}>Giá trị BĐS</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'right' }}>Doanh thu / HH</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {txRows.length > 0 ? (
                  txRows.map((tx: any, idx: number) => {
                    const isBooking = tx.status === 'booking';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '52px' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 800, color: '#a31422' }}>{tx.deposit_code}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{tx.customer_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{tx.customer_phone}</div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{tx.project_name}</div>
                          {tx.unit_code && tx.unit_code !== '—' && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Mã căn: {tx.unit_code}</div>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={tx.sale_avatar} name={tx.sale_name || 'Sale'} size={26} />
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{tx.sale_name}</div>
                              {tx.sale_email && <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{tx.sale_email}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{tx.channel} • {tx.donvi_chay}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{tx.lead_phan_loai}</div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>
                          {tx.property_value > 0 ? formatVND(tx.property_value) : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                          {tx.revenue_amount > 0 ? formatVND(tx.revenue_amount) : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              background: isBooking ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                              color: isBooking ? '#d97706' : '#059669'
                            }}
                          >
                            {isBooking ? 'Booking' : 'Đặt cọc'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                      Chưa có giao dịch trong khoảng thời gian / bộ lọc này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
