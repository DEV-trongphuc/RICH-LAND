import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, TrendingUp, Award, Flame, Filter, Layers, Building2,
  CheckCircle2, PhoneCall, Handshake, DollarSign,
  BarChart2, PieChart as PieChartIcon, Search, RefreshCw, Briefcase, Zap, GitBranch, X, SlidersHorizontal
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell
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
  if (val >= 1_000) {
    return Math.round(val / 1_000).toLocaleString('vi-VN') + 'k';
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
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {centerValue}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {centerLabel}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
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
  isMobile
}) => {
  const [loading, setLoading] = useState(true);
  const [syncingAds, setSyncingAds] = useState(false);
  const [payload, setPayload] = useState<any>(null);

  // Advanced Filter Sidebar Drawer state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Filters
  const [selectedSaleId, setSelectedSaleId] = useState<string>('all');
  const [careRole, setCareRole] = useState<'all' | 'primary' | 'coop'>('all');
  const [leadSourceType, setLeadSourceType] = useState<'all' | 'distributed' | 'databank' | 'personal'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [selectedPhanLoai, setSelectedPhanLoai] = useState<string>('all');
  const [selectedDonvi, setSelectedDonvi] = useState<string>('all');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [mktTableMode, setMktTableMode] = useState<'crm_campaign' | 'fb_campaign' | 'project'>('crm_campaign');

  const reqIdRef = useRef(0);

  const dateRange = useMemo(() => resolveDateRangeFromFilter(dateFilter), [dateFilter]);

  const fetchTabMetrics = async (signal?: AbortSignal, forceSyncAds = false) => {
    if (activeSubTab === 'distribution') return;
    const reqId = ++reqIdRef.current;
    if (forceSyncAds) {
      setSyncingAds(true);
    } else {
      setLoading(true);
    }
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
      if (forceSyncAds) params.set('sync_ads', '1');

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
        setSyncingAds(false);
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

  // Compute active filter chips
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (!isSaleOnly && activeSubTab !== 'mkt_perf' && selectedSaleId !== 'all') {
      const found = saleUserOptions.find(o => o.value === selectedSaleId);
      chips.push({
        key: 'sale',
        label: `Sale: ${found?.label || selectedSaleId}`,
        onClear: () => setSelectedSaleId('all')
      });
    }
    if (selectedProjectId !== 'all') {
      const found = projectOptions.find(o => o.value === selectedProjectId);
      chips.push({
        key: 'project',
        label: `Dự án: ${found?.label || selectedProjectId}`,
        onClear: () => {
          setSelectedProjectId('all');
          setSelectedCampaignId('all');
        }
      });
    }
    if (selectedCampaignId !== 'all') {
      const found = campaignOptions.find(o => o.value === selectedCampaignId);
      chips.push({
        key: 'campaign',
        label: `Chiến dịch: ${found?.label || selectedCampaignId}`,
        onClear: () => setSelectedCampaignId('all')
      });
    }
    if (selectedPhanLoai !== 'all') {
      chips.push({
        key: 'phanloai',
        label: `Phân loại: ${selectedPhanLoai}`,
        onClear: () => setSelectedPhanLoai('all')
      });
    }
    if (activeSubTab !== 'sale_perf' && selectedDonvi !== 'all') {
      chips.push({
        key: 'donvi',
        label: `Đơn vị: ${selectedDonvi}`,
        onClear: () => setSelectedDonvi('all')
      });
    }
    if (activeSubTab === 'sale_perf' && careRole !== 'all') {
      chips.push({
        key: 'role',
        label: `Vai trò: ${careRole === 'primary' ? 'Chăm chính' : 'Hợp tác'}`,
        onClear: () => setCareRole('all')
      });
    }
    if (activeSubTab === 'sale_perf' && leadSourceType !== 'all') {
      const srcMap: Record<string, string> = {
        distributed: 'Khách được chia',
        databank: 'Kho Databank',
        personal: 'Cá nhân / Giới thiệu'
      };
      chips.push({
        key: 'source',
        label: `Nguồn: ${srcMap[leadSourceType] || leadSourceType}`,
        onClear: () => setLeadSourceType('all')
      });
    }
    return chips;
  }, [
    isSaleOnly,
    activeSubTab,
    selectedSaleId,
    selectedProjectId,
    selectedCampaignId,
    selectedPhanLoai,
    selectedDonvi,
    careRole,
    leadSourceType,
    saleUserOptions,
    projectOptions,
    campaignOptions
  ]);

  const activeFilterCount = activeFilterChips.length;

  const kpis = payload?.kpis || {};
  const funnel = payload?.funnel || { rates: {} };
  const rates = funnel.rates || {};

  // ===========================================================================
  // SLIDE-OVER ADVANCED FILTER SIDEBAR DRAWER (Matches ContactsPage.tsx L3128-3365)
  // ===========================================================================
  const renderAdvancedFilterDrawer = () => {
    if (!isFilterDrawerOpen || typeof document === 'undefined') return null;

    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 2147483640, display: 'flex', justifyContent: 'flex-end' }}>
        {/* Backdrop */}
        <div
          onClick={() => setIsFilterDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        />

        {/* Slide-Over Sidebar Panel */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '420px',
            background: 'var(--color-surface)',
            height: '100%',
            boxShadow: '-12px 0 36px rgba(0, 0, 0, 0.18)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1,
            animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--color-border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(163, 20, 34, 0.05) 0%, transparent 100%)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #a31422 0%, #c81e2b 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(163, 20, 34, 0.25)'
                }}
              >
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                  Bộ lọc nâng cao
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0', fontWeight: 500 }}>
                  {activeSubTab === 'sale_perf' && 'Phân tích Hiệu quả Chăm sóc & Chuyển đổi Sale'}
                  {activeSubTab === 'mkt_perf' && 'Phân tích Hiệu quả Chiến dịch & Chi phí MKT (Ads)'}
                  {activeSubTab === 'revenue' && 'Phân tích Doanh thu, Giao dịch & Hiệu suất ROAS'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(false)}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body */}
          <div
            className="custom-scrollbar"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            {/* Section 1: Dự án & Chiến dịch */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={14} color="#a31422" />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text)' }}>
                  Dự án & Chiến dịch
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  {activeSubTab === 'mkt_perf' ? 'Dự án gốc (Marketing)' : 'Dự án chăm sóc (CRM)'}
                </label>
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
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  {activeSubTab === 'mkt_perf' ? 'Chiến dịch gốc (Bảng Leads / CAMPAIGN)' : 'Chiến dịch chăm sóc'}
                </label>
                <CustomSelect
                  options={campaignOptions}
                  value={selectedCampaignId}
                  onChange={(val) => setSelectedCampaignId(String(val))}
                  searchable={true}
                  width="100%"
                />
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--color-border-light)' }} />

            {/* Section 2: Phân loại & Đơn vị chạy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={14} color="#3b82f6" />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text)' }}>
                  Phân loại & Đơn vị triển khai
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                  Phân loại Lead
                </label>
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
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                    Đơn vị triển khai (Inhouse / Agency)
                  </label>
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

            {/* Section 3: Nhân sự Sale & Vai trò (for Sale Perf & Revenue) */}
            {activeSubTab !== 'mkt_perf' && (
              <>
                <div style={{ height: 1, background: 'var(--color-border-light)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={14} color="#10b981" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text)' }}>
                      Nhân sự & Nguồn chăm sóc
                    </span>
                  </div>

                  {!isSaleOnly && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                        Nhân sự Sale phụ trách
                      </label>
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

                  {activeSubTab === 'sale_perf' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                          Vai trò chăm sóc
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                          {[
                            { id: 'all', label: 'Tất cả vai trò (Chăm chính + Hợp tác)' },
                            { id: 'primary', label: 'Chỉ khách Chăm chính' },
                            { id: 'coop', label: 'Chỉ khách Hợp tác (Đồng chăm sóc)' }
                          ].map(item => {
                            const active = careRole === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setCareRole(item.id as any)}
                                style={{
                                  padding: '9px 12px',
                                  borderRadius: '8px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  textAlign: 'left',
                                  border: active ? '1.5px solid #a31422' : '1px solid var(--color-border-light)',
                                  background: active ? 'rgba(163, 20, 34, 0.08)' : 'var(--color-bg)',
                                  color: active ? '#a31422' : 'var(--color-text)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <span>{item.label}</span>
                                {active && <CheckCircle2 size={15} color="#a31422" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                          Nguồn tiếp nhận khách hàng
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
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
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  border: active ? '1.5px solid #a31422' : '1px solid var(--color-border-light)',
                                  background: active ? 'rgba(163, 20, 34, 0.08)' : 'var(--color-bg)',
                                  color: active ? '#a31422' : 'var(--color-text)',
                                  cursor: 'pointer'
                                }}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Drawer Footer */}
          <div
            style={{
              padding: '16px 22px',
              borderTop: '1px solid var(--color-border-light)',
              background: 'var(--color-bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <button
              type="button"
              onClick={resetFilters}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} /> Đặt lại
            </button>
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(false)}
              style={{
                flex: 1.4,
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #a31422 0%, #c81e2b 100%)',
                color: 'white',
                fontSize: '0.825rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(163, 20, 34, 0.25)'
              }}
            >
              Xem kết quả ({activeFilterCount > 0 ? `${activeFilterCount} bộ lọc` : 'Tất cả'})
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // ===========================================================================
  // COMPACT FILTER BAR + DRAWER TRIGGER (Zero z-index overlap!)
  // ===========================================================================
  const renderFilterBar = () => (
    <>
      {renderAdvancedFilterDrawer()}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.15rem',
          marginBottom: '1.25rem',
          animation: 'slideUp 0.35s ease-out both'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: '10px'
          }}
        >
          {/* Left: Context Badge + Quick Role/Source Pills + Active Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: '8px',
                background: 'rgba(163, 20, 34, 0.08)',
                color: '#a31422',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              <Filter size={13} />
              {activeSubTab === 'sale_perf' && (isSaleOnly ? 'Hiệu Quả Cá Nhân & Hợp Tác' : 'Phân Tích Hiệu Quả Sale')}
              {activeSubTab === 'mkt_perf' && 'Hiệu Quả Chiến Dịch & Chi Phí Ads (MKT)'}
              {activeSubTab === 'revenue' && 'Doanh Thu, Giao Dịch & Hiệu Suất Đầu Tư (ROAS)'}
            </span>

            {activeSubTab === 'sale_perf' && !isMobile && (
              <div
                style={{
                  display: 'flex',
                  background: 'var(--color-bg)',
                  padding: '3px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border-light)'
                }}
              >
                {[
                  { id: 'all', label: 'Tất cả vai trò' },
                  { id: 'primary', label: 'Chăm chính' },
                  { id: 'coop', label: 'Hợp tác' }
                ].map(item => {
                  const active = careRole === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCareRole(item.id as any)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: active ? 'var(--color-surface)' : 'transparent',
                        color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active Filter Chips */}
            {activeFilterChips.map(chip => (
              <span
                key={chip.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 9px',
                  borderRadius: '999px',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '0.73rem',
                  fontWeight: 600
                }}
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onClear}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#a31422',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 6px'
                }}
              >
                Xóa tất cả
              </button>
            )}
          </div>

          {/* Right: Sync Ads Button + Advanced Filter Sidebar Trigger Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {(activeSubTab === 'mkt_perf' || activeSubTab === 'revenue') && (
              <button
                type="button"
                onClick={() => fetchTabMetrics(undefined, true)}
                disabled={syncingAds}
                title="Đồng bộ dữ liệu Chi phí Quảng cáo mới nhất từ máy chủ Ads (103.15.50.12)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  cursor: syncingAds ? 'wait' : 'pointer',
                  opacity: syncingAds ? 0.7 : 1
                }}
              >
                <RefreshCw size={13} className={syncingAds ? 'animate-spin' : ''} />
                <span>{syncingAds ? 'Đang đồng bộ Ads...' : 'Đồng bộ Chi phí Ads'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: activeFilterCount > 0 ? '1.5px solid #a31422' : '1px solid var(--color-border)',
                background: activeFilterCount > 0 ? 'rgba(163, 20, 34, 0.08)' : 'var(--color-surface)',
                color: activeFilterCount > 0 ? '#a31422' : 'var(--color-text)',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              <SlidersHorizontal size={14} />
              <span>Bộ lọc nâng cao</span>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: '999px',
                    background: '#a31422',
                    color: '#fff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
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

        {/* Row 3: Staff Comparison Table with Avatar */}
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
  // TAB 2: HIỆU QUẢ MKT & CHI PHÍ ADS (`mkt_perf`)
  // ===========================================================================
  if (activeSubTab === 'mkt_perf') {
    const rawMktRows =
      mktTableMode === 'fb_campaign'
        ? (payload?.by_fb_campaign_table || [])
        : mktTableMode === 'project'
        ? (payload?.by_project_table || [])
        : (payload?.by_campaign_table || []);
    const activeMktRows = !tableSearch.trim()
      ? rawMktRows
      : rawMktRows.filter((r: any) => {
          const q = tableSearch.toLowerCase();
          return (
            String(r.campaign_name || r.project_name || '').toLowerCase().includes(q) ||
            String(r.campaign_id || '').toLowerCase().includes(q) ||
            String(r.project_name || '').toLowerCase().includes(q) ||
            String(r.donvi_chay || '').toLowerCase().includes(q) ||
            String(r.lead_phan_loai || '').toLowerCase().includes(q)
          );
        });

    const mktKpiCards: NativeKpiCardItem[] = [
      {
        id: 'mkt-spend',
        label: 'TỔNG CHI PHÍ MKT (ADS)',
        value: formatCompactVND(Number(kpis.total_spend || 0)),
        color: '#a31422',
        iconBg: 'rgba(163, 20, 34, 0.08)',
        icon: DollarSign,
        decor: 'bolt',
        dots: [
          { color: '#a31422', text: formatVND(Number(kpis.total_spend || 0)) },
          { color: '#3b82f6', text: `Clicks: ${Number(kpis.total_clicks || 0).toLocaleString('vi-VN')}` }
        ],
        footerHighlight: `${Number(kpis.total_impressions || 0).toLocaleString('vi-VN')} hiển thị`,
        footerText: `• ${Number(kpis.fb_leads || 0).toLocaleString('vi-VN')} FB Ads Leads`
      },
      {
        id: 'mkt-total-cpl',
        label: 'TỔNG LEAD GỐC & CPL',
        value: `${Number(kpis.total_leads || 0).toLocaleString('vi-VN')} leads`,
        color: '#3b82f6',
        iconBg: 'rgba(59, 130, 246, 0.08)',
        icon: Layers,
        decor: 'network',
        dots: [
          { color: '#3b82f6', text: `CPL: ${formatCompactVND(Number(kpis.cpl || 0))}` },
          { color: '#64748b', text: `CS Dài hạn: ${kpis.cham_soc_dai_han_count || 0}` }
        ],
        footerHighlight: `CPL ${formatVND(Number(kpis.cpl || 0))}`,
        footerText: 'chi phí trung bình / 1 Lead'
      },
      {
        id: 'mkt-ql-cpql',
        label: 'QUALIFIED LEAD (QL) & CPQL',
        value: `${Number(kpis.ql_count || 0).toLocaleString('vi-VN')} QL`,
        color: '#10b981',
        iconBg: 'rgba(16, 185, 129, 0.08)',
        icon: CheckCircle2,
        decor: 'user',
        dots: [
          { color: '#10b981', text: `Tỉ lệ QL: ${kpis.ql_rate || 0}%` },
          { color: '#ef4444', text: `Not Lead: ${kpis.not_lead_count || 0}` }
        ],
        footerHighlight: `CPQL ${formatVND(Number(kpis.cpql || 0))}`,
        footerText: 'chi phí trung bình / 1 QL'
      },
      {
        id: 'mkt-mql-sql-gd',
        label: 'CHUYỂN ĐỔI & CHI PHÍ CHỐT',
        value: `${Number(kpis.giao_dich_count || 0).toLocaleString('vi-VN')} chốt`,
        color: '#f59e0b',
        iconBg: 'rgba(245, 158, 11, 0.08)',
        icon: Award,
        decor: 'alert',
        dots: [
          { color: '#f59e0b', text: `M_QL: ${kpis.m_ql_count || 0} (${formatCompactVND(Number(kpis.cpmql || 0))})` },
          { color: '#06b6d4', text: `S_QL: ${kpis.s_ql_count || 0} (${formatCompactVND(Number(kpis.cpsql || 0))})` }
        ],
        footerHighlight: `Tỉ lệ chốt ${rates.ti_le_chot || 0}%`,
        footerText: `• CP/GD: ${formatCompactVND(Number(kpis.cost_per_deal || 0))}`
      }
    ];

    const unitCostMetrics = [
      {
        code: 'CPL',
        title: 'Chi phí / Lead (CPL)',
        value: formatVND(Number(kpis.cpl || 0)),
        sub: `${Number(kpis.total_leads || 0).toLocaleString('vi-VN')} Tổng Lead`,
        color: '#3b82f6'
      },
      {
        code: 'CPQL',
        title: 'Chi phí / Qualified Lead',
        value: formatVND(Number(kpis.cpql || 0)),
        sub: `${Number(kpis.ql_count || 0).toLocaleString('vi-VN')} QL (${kpis.ql_rate || 0}%)`,
        color: '#10b981'
      },
      {
        code: 'CPMQL',
        title: 'Chi phí / Quan tâm (M_QL)',
        value: formatVND(Number(kpis.cpmql || 0)),
        sub: `${Number(kpis.m_ql_count || 0).toLocaleString('vi-VN')} M_QL (${rates.tuong_tac_lan_1 || 0}%)`,
        color: '#f59e0b'
      },
      {
        code: 'CP-ĐYG',
        title: 'Chi phí / Đồng ý gặp',
        value: formatVND(Number(kpis.cpdyg || 0)),
        sub: `${Number(kpis.dong_y_gap_count || 0).toLocaleString('vi-VN')} Khách hẹn gặp`,
        color: '#8b5cf6'
      },
      {
        code: 'CPSQL',
        title: 'Chi phí / Đã gặp (S_QL)',
        value: formatVND(Number(kpis.cpsql || 0)),
        sub: `${Number(kpis.s_ql_count || 0).toLocaleString('vi-VN')} Khách đã gặp`,
        color: '#a31422'
      }
    ];

    return (
      <div>
        {renderFilterBar()}
        <NativeStatCardGrid cards={mktKpiCards} />

        {/* Unit Cost Efficiency Bar (CPL • CPQL • CPMQL • CP-ĐYG • CPSQL) */}
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={17} color="#a31422" />
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Định Mức Chi Phí Chuyển Đổi Marketing (Dữ liệu thực tế từ INSIGHT_ADS.LOGS_DAILY_LEVEL_AD & CHIPHI_DUAN)
              </span>
            </div>
            <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              Tổng ngân sách lọc: <strong style={{ color: '#a31422' }}>{formatVND(Number(kpis.total_spend || 0))}</strong>
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
              gap: '10px'
            }}
          >
            {unitCostMetrics.map((m) => (
              <div
                key={m.code}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border-light)',
                  borderLeft: `3.5px solid ${m.color}`
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{m.title}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: m.color, margin: '4px 0 2px 0' }}>{m.value}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-light)', fontWeight: 600 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 1: MKT Timeline Chart (6fr) + Original Project Spend & Lead Breakdown (4fr) */}
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
                <BarChart2 size={18} color="#a31422" /> Biểu Đồ Chi Phí MKT (Triệu ₫) & Lượng Lead Theo Thời Gian
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Đối chiếu Ngân sách Quảng cáo đã tiêu (Triệu VNĐ) với Tổng Lead và Qualified Lead (QL)
              </p>
            </div>
            {(payload?.timeline_chart || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={265}>
                <ComposedChart data={payload.timeline_chart} margin={{ left: -10, right: 5, top: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={42} />
                  <YAxis yAxisId="right" orientation="right" unit=" tr" tick={{ fontSize: 10, fill: '#a31422' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    formatter={(val: any, name: any) => {
                      if (String(name).includes('Chi phí')) return [`${Number(val).toLocaleString('vi-VN')} triệu ₫`, name];
                      return [Number(val).toLocaleString('vi-VN'), name];
                    }}
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar yAxisId="left" dataKey="total_leads" name="Tổng Lead" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar yAxisId="left" dataKey="ql" name="Qualified Lead (QL)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Line yAxisId="right" type="monotone" dataKey="spend_millions" name="Chi phí MKT (Triệu ₫)" stroke="#a31422" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 265, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                Chưa có dữ liệu thống kê
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <Building2 size={18} color="#a31422" /> Chi Phí & Hiệu Quả Theo Dự Án Gốc (MKT)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Tổng hợp Chi phí Ads, số lượng Lead và CPL theo từng Dự án
              </p>
            </div>
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', maxHeight: 265, paddingRight: 4 }}>
              {(payload?.by_project_chart || []).length > 0 ? (
                (() => {
                  const list = payload.by_project_chart;
                  const maxVal = Math.max(1, ...list.map((x: any) => Number(x.value || 0)));
                  return list.map((p: any, idx: number) => {
                    const barPct = Math.round((Number(p.value || 0) / maxVal) * 100);
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', width: 18 }}>#{idx + 1}</span>
                            <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.name}
                            </span>
                          </span>
                          <span style={{ color: 'var(--color-text)', fontWeight: 700, flexShrink: 0, marginLeft: 8, fontSize: '0.76rem' }}>
                            <span style={{ color: '#a31422' }}>{formatCompactVND(Number(p.spend || 0))}</span>
                            {' • '}
                            <span>{Number(p.value || 0).toLocaleString('vi-VN')} lead</span>
                            {Number(p.cpl || 0) > 0 && (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}> (CPL: {formatCompactVND(Number(p.cpl))})</span>
                            )}
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden', marginLeft: 24 }}>
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

        {/* Row 2: 3 Clean Donut Charts (Phân loại Lead • Chi phí theo Dự án • Chi phí theo Đơn vị chạy) */}
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
            title="Phân Bổ Chi Phí Theo Dự Án"
            subtitle="Tỉ trọng ngân sách MKT theo Dự án"
            icon={DollarSign}
            iconColor="#a31422"
            data={payload?.by_spend_project_chart || []}
            centerValue={formatCompactVND(Number(kpis.total_spend || 0))}
            centerLabel="Tổng Chi Phí"
            isCurrency={true}
          />
          <DonutCardWithCustomLegend
            title="Chi Phí Theo Đơn Vị Chạy"
            subtitle="Inhouse vs Agency / Outsource"
            icon={Briefcase}
            iconColor="#f59e0b"
            data={
              (payload?.by_spend_donvi_chart || []).some((x: any) => Number(x.value || 0) > 0)
                ? payload.by_spend_donvi_chart
                : (payload?.by_donvi_chart || [])
            }
            centerValue={
              (payload?.by_spend_donvi_chart || []).some((x: any) => Number(x.value || 0) > 0)
                ? formatCompactVND(Number(kpis.total_spend || 0))
                : (payload?.by_donvi_chart || []).length
            }
            centerLabel="Đơn vị"
            isCurrency={(payload?.by_spend_donvi_chart || []).some((x: any) => Number(x.value || 0) > 0)}
          />
        </div>

        {/* Row 3: Multi-Mode MKT Cost & Conversion Table */}
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
                <Layers size={18} color="#a31422" /> Bảng Đánh Giá Chi Phí Quảng Cáo & Hiệu Quả Chuyển Đổi MKT
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0 0' }}>
                Đo lường đầy đủ Chi phí MKT, CPL, CPQL, CPMQL, CPSQL và Tỉ lệ chuyển đổi từ bảng `LOGS_DAILY_LEVEL_AD` & `leads`
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Mode Switcher */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--color-bg)',
                  padding: '3px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border-light)'
                }}
              >
                {[
                  { id: 'crm_campaign', label: 'Chiến dịch Kinh doanh (CRM)' },
                  { id: 'fb_campaign', label: 'Chiến dịch FB Ads (Insights)' },
                  { id: 'project', label: 'Theo Dự án & Phân loại' }
                ].map(tab => {
                  const active = mktTableMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMktTableMode(tab.id as any)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        background: active ? 'var(--color-surface)' : 'transparent',
                        color: active ? '#a31422' : 'var(--color-text-muted)',
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
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
                  minWidth: isMobile ? '100%' : '230px'
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
          </div>

          <div
            className="custom-scrollbar"
            style={{
              overflowX: 'auto',
              maxHeight: '460px',
              overflowY: 'auto',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              background: 'var(--color-surface)'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '1320px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>
                    {mktTableMode === 'project' ? 'Dự án gốc (MKT)' : mktTableMode === 'fb_campaign' ? 'Chiến dịch FB Ads (Insights)' : 'Chiến dịch gốc (MKT)'}
                  </th>
                  {mktTableMode !== 'project' && (
                    <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Dự án gốc</th>
                  )}
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)' }}>Đơn vị / Phân loại</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'right' }}>Chi phí MKT</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Tổng Lead</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Not Lead</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>QL (%)</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>M_QL</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>S_QL</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Giao dịch</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'right' }}>CPL</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'right' }}>CPQL</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'right' }}>CPMQL</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'right' }}>CPSQL</th>
                  <th style={{ padding: '12px', position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 2, borderBottom: '2px solid var(--color-border-light)', textAlign: 'center' }}>Tỉ Lệ Chốt</th>
                </tr>
              </thead>
              <tbody>
                {activeMktRows.length > 0 ? (
                  activeMktRows.map((row: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '50px' }}>
                      <td style={{ padding: '8px 12px', maxWidth: 280 }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.campaign_name || row.project_name}>
                          {mktTableMode === 'project' ? row.project_name : row.campaign_name}
                        </div>
                        {row.campaign_id && row.campaign_id !== row.campaign_name && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>ID: {row.campaign_id}</div>
                        )}
                      </td>
                      {mktTableMode !== 'project' && (
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-text)' }}>{row.project_name}</td>
                      )}
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.donvi_chay}</span>
                        {row.lead_phan_loai && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: 5 }}>• {row.lead_phan_loai}</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#a31422' }}>
                        {Number(row.spend || 0) > 0 ? formatVND(Number(row.spend)) : '0 ₫'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--color-text)' }}>
                        {row.total_leads}
                        {mktTableMode === 'fb_campaign' && Number(row.fb_leads || 0) > 0 && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 500 }}>
                            (FB: {row.fb_leads})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{row.not_lead_count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700 }}>{row.ql_count}</span>{' '}
                        <span style={{ padding: '2px 5px', borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                          {row.rates?.ql_rate || 0}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#d97706' }}>{row.m_ql_count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#0891b2' }}>{row.s_ql_count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.76rem', background: row.giao_dich_count > 0 ? 'rgba(163, 20, 34, 0.1)' : 'var(--color-bg)', color: row.giao_dich_count > 0 ? '#a31422' : 'var(--color-text-muted)' }}>
                          {row.giao_dich_count}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                        {Number(row.cpl || 0) > 0 ? formatCompactVND(Number(row.cpl)) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                        {Number(row.cpql || 0) > 0 ? formatCompactVND(Number(row.cpql)) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>
                        {Number(row.cpmql || 0) > 0 ? formatCompactVND(Number(row.cpmql)) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#a31422' }}>
                        {Number(row.cpsql || 0) > 0 ? formatCompactVND(Number(row.cpsql)) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.74rem', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                          {row.rates?.ti_le_chot || 0}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={15} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
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
  // TAB 3: DOANH THU & ROAS (`revenue`)
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
        label: 'TỔNG GIÁ TRỊ BĐS (GMV)',
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
        footerHighlight: 'Doanh thu thực tế',
        footerText: 'tổng hợp theo Dự án & Sale'
      },
      {
        id: 'rev-roas',
        label: 'CHI PHÍ MKT & HIỆU SUẤT ROAS',
        value: formatCompactVND(Number(kpis.total_mkt_spend || 0)),
        color: '#f59e0b',
        iconBg: 'rgba(245, 158, 11, 0.08)',
        icon: DollarSign,
        decor: 'alert',
        dots: [
          { color: '#10b981', text: `ROAS: ${kpis.roas || 0}x` },
          { color: '#a31422', text: `CIR (CP/DT): ${kpis.cir_percent || 0}%` }
        ],
        footerHighlight: `ROAS ${kpis.roas || 0}x`,
        footerText: `• Tỉ lệ Chi phí / Doanh thu: ${kpis.cir_percent || 0}%`
      }
    ];

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

        {/* 2x2 Grid of Donut Charts */}
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
            title="Cơ Cấu Doanh Thu Theo Dự Án"
            subtitle="Phân bổ doanh thu & giao dịch theo Dự án"
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
            subtitle="Tỉ trọng doanh thu theo Phân loại Lead"
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
