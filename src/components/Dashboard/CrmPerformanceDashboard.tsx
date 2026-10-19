import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, TrendingUp, Award, Flame, Filter, Layers, Building2,
  CheckCircle2, PhoneCall, Handshake, DollarSign, Percent,
  BarChart2, PieChart as PieChartIcon, Search, RefreshCw, Info, Briefcase
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts';
import { CustomSelect } from '../ui/CustomSelect';
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
  '#BD1D2D',
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
  '#64748B'
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
      label: u.team_name ? `${u.name} (${u.team_name})` : u.name
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

  const kpis = payload?.kpis || {};
  const funnel = payload?.funnel || {};
  const funnelRates = funnel?.rates || {
    tuong_tac_lan_1: 0,
    ti_le_dot_lua: 0,
    ti_le_chot: 0,
    chuyen_doi_chung: 0,
    ql_rate: 0
  };

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

  const hasActiveFilters =
    selectedSaleId !== 'all' ||
    careRole !== 'all' ||
    leadSourceType !== 'all' ||
    selectedProjectId !== 'all' ||
    selectedCampaignId !== 'all' ||
    selectedPhanLoai !== 'all' ||
    selectedDonvi !== 'all';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* FILTER BAR — Synchronized with RichLand CRM Solid Light Design System */}
      <div
        className="card"
        style={{
          padding: isMobile ? '0.875rem' : '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
          border: '1px solid var(--color-border-light)'
        }}
      >
        {/* Top Row: Scope Pills & Attribution Notice */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          {activeSubTab === 'sale_perf' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
                Vai trò chăm sóc:
              </span>
              {[
                { key: 'all', label: 'Tất cả (Chính + Hợp tác)' },
                { key: 'primary', label: 'Phụ trách chính' },
                { key: 'coop', label: 'Đồng chăm sóc / Hợp tác' }
              ].map(item => {
                const active = careRole === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setCareRole(item.key as any)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: active ? 700 : 600,
                      border: active ? '1px solid #BD1D2D' : '1px solid var(--color-border)',
                      background: active ? '#BD1D2D' : 'var(--color-bg)',
                      color: active ? '#ffffff' : 'var(--color-text)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}

              <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 4px' }} />

              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
                Nguồn khách:
              </span>
              {[
                { key: 'all', label: 'Tất cả nguồn' },
                { key: 'distributed', label: 'Được chia' },
                { key: 'databank', label: 'Kho Databank' },
                { key: 'personal', label: 'Cá nhân / Giới thiệu' }
              ].map(item => {
                const active = leadSourceType === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setLeadSourceType(item.key as any)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      fontWeight: active ? 700 : 600,
                      border: active ? '1px solid #1e293b' : '1px solid var(--color-border)',
                      background: active ? '#1e293b' : 'var(--color-bg)',
                      color: active ? '#ffffff' : 'var(--color-text)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : activeSubTab === 'mkt_perf' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              <Info size={15} style={{ color: '#BD1D2D', flexShrink: 0 }} />
              <span>
                Đo lường <strong style={{ color: 'var(--color-text)' }}>Hiệu quả MKT</strong> theo đúng <strong style={{ color: '#BD1D2D' }}>Dự án gốc & Chiến dịch gốc trên bảng Leads</strong> (Sale đổi dự án/chiến dịch chăm sóc không làm lệch số gốc của MKT).
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              <DollarSign size={15} style={{ color: '#10B981', flexShrink: 0 }} />
              <span>
                Tổng hợp <strong style={{ color: 'var(--color-text)' }}>Doanh Thu & Giao Dịch</strong> theo Dự án, Phân loại Lead, Kênh và Đơn vị chạy.
              </span>
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid rgba(189, 29, 45, 0.25)',
                background: 'rgba(189, 29, 45, 0.06)',
                color: '#BD1D2D',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={12} /> Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Bottom Row: Searchable Dropdowns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : activeSubTab === 'sale_perf' && !isSaleOnly
                ? 'repeat(4, minmax(0, 1fr))'
                : 'repeat(4, minmax(0, 1fr))',
            gap: '0.75rem'
          }}
        >
          {/* Sale Filter (for Admin/Manager on Sale Perf or Revenue) */}
          {!isSaleOnly && (activeSubTab === 'sale_perf' || activeSubTab === 'revenue') && (
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Nhân sự Sale (Tìm kiếm tên)
              </label>
              <CustomSelect
                searchable={true}
                options={saleUserOptions}
                value={selectedSaleId}
                onChange={val => setSelectedSaleId(String(val || 'all'))}
                placeholder="Chọn hoặc tìm Sale..."
                width="100%"
              />
            </div>
          )}

          {/* Project Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              {activeSubTab === 'mkt_perf' ? 'Dự án gốc (MKT)' : 'Dự án chăm sóc (Sale)'}
            </label>
            <CustomSelect
              searchable={true}
              options={projectOptions}
              value={selectedProjectId}
              onChange={val => {
                setSelectedProjectId(String(val || 'all'));
                setSelectedCampaignId('all');
              }}
              placeholder="Chọn dự án..."
              width="100%"
            />
          </div>

          {/* Campaign Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              {activeSubTab === 'mkt_perf' ? 'Chiến dịch gốc (MKT)' : 'Chiến dịch chăm sóc (Sale)'}
            </label>
            <CustomSelect
              searchable={true}
              options={campaignOptions}
              value={selectedCampaignId}
              onChange={val => setSelectedCampaignId(String(val || 'all'))}
              placeholder="Chọn chiến dịch..."
              width="100%"
            />
          </div>

          {/* Lead Classification / Running Unit Filter */}
          {activeSubTab === 'mkt_perf' ? (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Phân loại Lead
                </label>
                <CustomSelect
                  searchable={true}
                  options={phanLoaiOptions}
                  value={selectedPhanLoai}
                  onChange={val => setSelectedPhanLoai(String(val || 'all'))}
                  placeholder="Tất cả phân loại..."
                  width="100%"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Đơn vị chạy
                </label>
                <CustomSelect
                  searchable={true}
                  options={donviOptions}
                  value={selectedDonvi}
                  onChange={val => setSelectedDonvi(String(val || 'all'))}
                  placeholder="Tất cả đơn vị chạy..."
                  width="100%"
                />
              </div>
            </>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Phân loại Lead
              </label>
              <CustomSelect
                searchable={true}
                options={phanLoaiOptions}
                value={selectedPhanLoai}
                onChange={val => setSelectedPhanLoai(String(val || 'all'))}
                placeholder="Tất cả phân loại..."
                width="100%"
              />
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1 & TAB 2: HIỆU QUẢ SALE & HIỆU QUẢ MKT                          */}
      {/* =================================================================== */}
      {(activeSubTab === 'sale_perf' || activeSubTab === 'mkt_perf') && (
        <>
          {/* KPI STAT CARDS ROW (Synchronized with App .stat-card) */}
          {loading && !payload ? (
            <div className="stats-grid" style={{ gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: '0.875rem' }}>
              {[1, 2, 3, 4, 5, 6].map(i => <KpiCardSkeleton key={i} />)}
            </div>
          ) : (
            <div
              className="stats-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, minmax(0, 1fr))',
                gap: '0.875rem'
              }}
            >
              {/* Card 1: Tổng Lead */}
              <div className="stat-card">
                <div className="stat-header" style={{ marginBottom: '6px' }}>
                  <span className="stat-title">TỔNG LEAD</span>
                  <div className="stat-icon" style={{ background: 'rgba(189, 29, 45, 0.1)', color: '#BD1D2D' }}>
                    <Users size={15} />
                  </div>
                </div>
                <div className="stat-value">{(kpis.total_leads || 0).toLocaleString()}</div>
                <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  {activeSubTab === 'sale_perf'
                    ? `Được chia: ${kpis.distributed_leads || 0} • Kho: ${kpis.databank_leads || 0}`
                    : `Chăm sóc dài hạn: ${kpis.cham_soc_dai_han_count || 0}`}
                </div>
              </div>

              {/* Card 2: Tổng QL & % QL */}
              <div className="stat-card">
                <div className="stat-header" style={{ marginBottom: '6px' }}>
                  <span className="stat-title">QUALIFIED LEAD (QL)</span>
                  <div className="stat-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563EB' }}>
                    <CheckCircle2 size={15} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <div className="stat-value">{(kpis.ql_count || 0).toLocaleString()}</div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '6px' }}>
                    {kpis.ql_rate || 0}%
                  </span>
                </div>
                <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Not Lead: <strong style={{ color: '#EF4444' }}>{kpis.not_lead_count || 0}</strong>
                </div>
              </div>

              {/* Card 3: M_QL (Quan tâm+) */}
              <div className="stat-card">
                <div className="stat-header" style={{ marginBottom: '6px' }}>
                  <span className="stat-title">M_QL (QUAN TÂM)</span>
                  <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#D97706' }}>
                    <PhoneCall size={15} />
                  </div>
                </div>
                <div className="stat-value">{(kpis.m_ql_count || 0).toLocaleString()}</div>
                <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Tương tác lần 1: <strong style={{ color: 'var(--color-text)' }}>{funnelRates.tuong_tac_lan_1}%</strong>
                </div>
              </div>

              {/* Card 4: Đồng ý gặp */}
              <div className="stat-card">
                <div className="stat-header" style={{ marginBottom: '6px' }}>
                  <span className="stat-title">ĐỒNG Ý GẶP</span>
                  <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#7C3AED' }}>
                    <Handshake size={15} />
                  </div>
                </div>
                <div className="stat-value">{(kpis.dong_y_gap_count || 0).toLocaleString()}</div>
                <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Thiện chí hẹn gặp tư vấn
                </div>
              </div>

              {/* Card 5: S_QL (Đã gặp) */}
              <div className="stat-card">
                <div className="stat-header" style={{ marginBottom: '6px' }}>
                  <span className="stat-title">S_QL (ĐÃ GẶP)</span>
                  <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#0891B2' }}>
                    <Flame size={15} />
                  </div>
                </div>
                <div className="stat-value">{(kpis.s_ql_count || 0).toLocaleString()}</div>
                <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Tỉ lệ đốt lửa: <strong style={{ color: 'var(--color-text)' }}>{funnelRates.ti_le_dot_lua}%</strong>
                </div>
              </div>

              {/* Card 6: Giao dịch (Booking + Đặt cọc) */}
              <div className="stat-card" style={{ borderLeft: '3px solid #BD1D2D' }}>
                <div className="stat-header" style={{ marginBottom: '6px' }}>
                  <span className="stat-title">GIAO DỊCH (CHỐT)</span>
                  <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}>
                    <Award size={15} />
                  </div>
                </div>
                <div className="stat-value" style={{ color: '#BD1D2D' }}>{(kpis.giao_dich_count || 0).toLocaleString()}</div>
                <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Tỉ lệ chốt: <strong style={{ color: '#10B981' }}>{funnelRates.ti_le_chot}%</strong> • CĐ chung: <strong>{funnelRates.chuyen_doi_chung}%</strong>
                </div>
              </div>
            </div>
          )}

          {/* CONVERSION FUNNEL & 4 CONVERSION RATES + TEMPERATURE PIE */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1.65fr 1fr',
              gap: '1.25rem'
            }}
          >
            {/* Left: Phễu chuyển đổi & 4 Tỉ lệ chuyển đổi cốt lõi */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Filter size={16} style={{ color: '#BD1D2D' }} />
                    Phễu Chuyển Đổi & Tỉ Lệ Chốt
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {funnel.note || 'Đo lường xuyên suốt từ Tổng Lead -> QL -> M_QL -> Đồng ý gặp -> S_QL -> Giao dịch'}
                  </p>
                </div>
                {activeSubTab === 'sale_perf' && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D' }}>
                    Phễu tính trên Khách được chia ({funnel.total_leads || 0} leads)
                  </span>
                )}
              </div>

              {/* 4 Conversion Rate Pill Boxes */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                  gap: '0.625rem'
                }}
              >
                {[
                  { label: 'Tương tác lần 1', formula: 'M_QL / Tổng Lead', value: funnelRates.tuong_tac_lan_1, color: '#2563EB' },
                  { label: 'Tỉ lệ đốt lửa', formula: 'S_QL / M_QL', value: funnelRates.ti_le_dot_lua, color: '#D97706' },
                  { label: 'Tỉ lệ chốt', formula: 'Giao dịch / S_QL', value: funnelRates.ti_le_chot, color: '#10B981' },
                  { label: 'Chuyển đổi chung', formula: 'Giao dịch / QL', value: funnelRates.chuyen_doi_chung, color: '#BD1D2D' }
                ].map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{r.label}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: r.color }}>{r.value}%</span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)' }}>{r.formula}</span>
                  </div>
                ))}
              </div>

              {/* Horizontal Funnel Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.25rem' }}>
                {[
                  { label: '1. Tổng Lead', count: funnel.total_leads || 0, color: '#334155' },
                  { label: '2. Qualified Lead (QL)', count: funnel.ql_count || 0, color: '#2563EB' },
                  { label: '3. Quan tâm (M_QL)', count: funnel.m_ql_count || 0, color: '#F59E0B' },
                  { label: '4. Đồng ý gặp', count: funnel.dong_y_gap_count || 0, color: '#8B5CF6' },
                  { label: '5. Đã gặp (S_QL)', count: funnel.s_ql_count || 0, color: '#06B6D4' },
                  { label: '6. Giao dịch (Booking + Cọc)', count: funnel.giao_dich_count || 0, color: '#BD1D2D' }
                ].map((step, idx, arr) => {
                  const maxVal = Math.max(1, arr[0].count || 1);
                  const pct = Math.min(100, Math.round((step.count / maxVal) * 100));
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: isMobile ? '130px' : '185px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>
                        {step.label}
                      </div>
                      <div style={{ flex: 1, height: '22px', background: 'var(--color-bg)', borderRadius: '6px', overflow: 'hidden', position: 'relative', border: '1px solid var(--color-border-light)' }}>
                        <div
                          style={{
                            width: `${Math.max(step.count > 0 ? 4 : 0, pct)}%`,
                            height: '100%',
                            background: step.color,
                            borderRadius: '5px',
                            transition: 'width 0.35s ease'
                          }}
                        />
                      </div>
                      <div style={{ width: '90px', textAlign: 'right', fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)', flexShrink: 0 }}>
                        {step.count.toLocaleString()} <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Tỉ trọng Nhiệt độ Lead (Nóng / Ấm / Lạnh) */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={16} style={{ color: '#BD1D2D' }} />
                  Tỉ Trọng Nhiệt Độ Khách Hàng
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Phân bổ Nóng • Ấm • Lạnh trên tập dữ liệu đang lọc
                </p>
              </div>

              <div style={{ width: '100%', height: 210, marginTop: '0.5rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={payload?.temperature_chart || []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {(payload?.temperature_chart || []).map((entry: any, index: number) => (
                        <Cell key={`temp-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} khách`, 'Số lượng']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                {(payload?.temperature_chart || []).map((tItem: any, idx: number) => {
                  const tot = Math.max(1, kpis.total_leads || 1);
                  const pct = ((tItem.value || 0) / tot * 100).toFixed(1);
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.625rem',
                        borderRadius: '8px',
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border-light)',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tItem.color }} />
                        {tItem.name}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: tItem.color, marginTop: '2px' }}>
                        {(tItem.value || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TIMELINE COMPOSED CHART & BREAKDOWN CHARTS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1.65fr 1fr',
              gap: '1.25rem'
            }}
          >
            {/* Biểu đồ kết hợp Phân loại Lead (M_QL, S_QL, Not Lead, % QL) theo Thời gian */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart2 size={16} style={{ color: '#BD1D2D' }} />
                  Biểu Đồ Kết Hợp Chỉ Số Lead (M_QL, S_QL, Not Lead & % QL) Theo Thời Gian
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Theo dõi xu hướng chất lượng Lead và chuyển đổi qua các mốc thời gian
                </p>
              </div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={payload?.timeline_chart || []} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#10B981' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                    <Bar yAxisId="left" dataKey="m_ql" name="M_QL (Quan tâm)" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar yAxisId="left" dataKey="s_ql" name="S_QL (Đã gặp)" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar yAxisId="left" dataKey="not_lead" name="Not Lead" fill="#94A3B8" radius={[4, 4, 0, 0]} barSize={18} />
                    <Line yAxisId="right" type="monotone" dataKey="ql_rate" name="% QL" stroke="#BD1D2D" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Chart: By Project / Source Breakdown */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} style={{ color: '#BD1D2D' }} />
                  {activeSubTab === 'sale_perf' ? 'Phân Bổ Khách Theo Dự Án Chăm Sóc' : 'Tỉ Trọng Lead Theo Dự Án Gốc (MKT)'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {activeSubTab === 'sale_perf'
                    ? 'Tính theo Dự án Sale đang chăm sóc trên hồ sơ khách hàng'
                    : 'Tính theo Dự án gốc từ chiến dịch Marketing'}
                </p>
              </div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={(payload?.by_project_chart || []).slice(0, 8)}
                    margin={{ top: 5, right: 24, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                    <YAxis dataKey="name" type="category" width={125} tick={{ fontSize: 11, fill: 'var(--color-text)' }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Số lượng Lead" fill="#BD1D2D" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* MKT EXTRA BREAKDOWN CHARTS (Loại Lead, Kênh, Đơn vị chạy) */}
          {activeSubTab === 'mkt_perf' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                gap: '1.25rem'
              }}
            >
              {[
                { title: 'Tỉ Trọng Theo Loại Lead', data: payload?.by_phan_loai_chart || [] },
                { title: 'Tỉ Trọng Theo Kênh MKT', data: payload?.by_channel_chart || [] },
                { title: 'Tỉ Trọng Theo Đơn Vị Chạy', data: payload?.by_donvi_chart || [] }
              ].map((chartBox, cIdx) => (
                <div key={cIdx} className="card" style={{ padding: '1.125rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    {chartBox.title}
                  </h4>
                  <div style={{ width: '100%', height: 210 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartBox.data}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {chartBox.data.map((_: any, i: number) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '0.72rem' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DETAILED TABLES */}
          {activeSubTab === 'sale_perf' ? (
            /* TABLE: BẢNG SO SÁNH HIỆU QUẢ NHÂN SỰ SALE */
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    Bảng So Sánh Hiệu Quả Chăm Sóc & Chuyển Đổi Theo Sale
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Đo lường theo Dự án & Chiến dịch Sale đang chăm sóc (Tỉ lệ chuyển đổi tính trên khách được chia)
                  </p>
                </div>
                <div style={{ position: 'relative', minWidth: isMobile ? '100%' : '250px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={e => setTableSearch(e.target.value)}
                    placeholder="Tìm nhanh tên nhân sự hoặc team..."
                    className="form-input"
                    style={{ paddingLeft: '30px', height: '34px', fontSize: '0.78rem', width: '100%' }}
                  />
                </div>
              </div>

              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>Nhân sự Sale</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800 }}>Team</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Tổng Lead</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Được chia</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Databank</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Hợp tác</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Not Lead</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>QL (%)</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>M_QL</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Đ.Ý Gặp</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>S_QL</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right', color: '#BD1D2D' }}>Giao dịch</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>CS Dài hạn</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'center' }}>Nóng / Ấm / Lạnh</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>TT Lần 1</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Đốt lửa</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Tỉ lệ chốt</th>
                      <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>CĐ Chung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payload?.staff_table || [])
                      .filter((r: any) => {
                        if (!tableSearch.trim()) return true;
                        const q = tableSearch.toLowerCase();
                        return (r.sale_name || '').toLowerCase().includes(q) || (r.team_name || '').toLowerCase().includes(q);
                      })
                      .map((row: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text)' }}>{row.sale_name}</td>
                          <td style={{ padding: '10px 10px', color: 'var(--color-text-muted)' }}>{row.team_name}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800 }}>{row.total_leads}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>{row.distributed_leads}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#2563EB' }}>{row.databank_leads}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#7C3AED' }}>{row.coop_leads}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#EF4444' }}>{row.not_lead_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>
                            {row.ql_count} <span style={{ fontSize: '0.7rem', color: '#10B981' }}>({row.ql_rate}%)</span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>{row.m_ql_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>{row.dong_y_gap_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#0891B2' }}>{row.s_ql_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#BD1D2D' }}>{row.giao_dich_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>{row.cham_soc_dai_han_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#BD1D2D', fontWeight: 700 }}>{row.temp_hot}</span>
                            {' / '}
                            <span style={{ color: '#F59E0B', fontWeight: 700 }}>{row.temp_warm}</span>
                            {' / '}
                            <span style={{ color: '#3B82F6', fontWeight: 700 }}>{row.temp_cold}</span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600 }}>{row.rates?.tuong_tac_lan_1 || 0}%</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600 }}>{row.rates?.ti_le_dot_lua || 0}%</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{row.rates?.ti_le_chot || 0}%</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#BD1D2D' }}>{row.rates?.chuyen_doi_chung || 0}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* MKT TABLES: BY PROJECT & BY ORIGINAL CAMPAIGN */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Table 1: By Original Project & Lead Classification */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    1. Bảng Hiệu Quả MKT Theo Dự Án Gốc & Phân Loại Lead
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Đo lường chất lượng chuyển đổi theo đúng Dự án gốc (`leads.project_id`) và Phân loại Lead (`leads.lead_phan_loai`)
                  </p>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 800 }}>Dự án gốc (MKT)</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800 }}>Phân loại Lead</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Tổng Lead</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Not Lead</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>QL (%)</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>M_QL</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Đ.Ý Gặp</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>S_QL</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right', color: '#BD1D2D' }}>Giao dịch</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'center' }}>Nóng / Ấm / Lạnh</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>TT Lần 1</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Đốt lửa</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Tỉ lệ chốt</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>CĐ Chung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payload?.by_project_table || []).map((row: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text)' }}>{row.project_name}</td>
                          <td style={{ padding: '10px 10px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'var(--color-bg)', fontWeight: 700, fontSize: '0.72rem' }}>
                              {row.lead_phan_loai}
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800 }}>{row.total_leads}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#EF4444' }}>{row.not_lead_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>
                            {row.ql_count} <span style={{ fontSize: '0.7rem', color: '#10B981' }}>({row.rates?.ql_rate || 0}%)</span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>{row.m_ql_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>{row.dong_y_gap_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#0891B2' }}>{row.s_ql_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#BD1D2D' }}>{row.giao_dich_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#BD1D2D', fontWeight: 700 }}>{row.temp_hot}</span>
                            {' / '}
                            <span style={{ color: '#F59E0B', fontWeight: 700 }}>{row.temp_warm}</span>
                            {' / '}
                            <span style={{ color: '#3B82F6', fontWeight: 700 }}>{row.temp_cold}</span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>{row.rates?.tuong_tac_lan_1 || 0}%</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>{row.rates?.ti_le_dot_lua || 0}%</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{row.rates?.ti_le_chot || 0}%</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#BD1D2D' }}>{row.rates?.chuyen_doi_chung || 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: By Original Campaign (`leads.campaign_id`) */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ marginBottom: '0.875rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    2. Bảng Hiệu Quả MKT Theo Chiến Dịch Gốc (`leads.campaign_id`)
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Danh sách chiến dịch gốc từ Marketing — giữ nguyên chỉ số gốc ngay cả khi Sale chuyển khách sang chiến dịch khác
                  </p>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 800 }}>Chiến dịch gốc (MKT)</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800 }}>Dự án gốc</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800 }}>Đơn vị chạy</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Tổng Lead</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Not Lead</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>QL (%)</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>M_QL</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Đ.Ý Gặp</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>S_QL</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right', color: '#BD1D2D' }}>Giao dịch</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'center' }}>Nóng / Ấm / Lạnh</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>TT Lần 1</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Đốt lửa</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Tỉ lệ chốt</th>
                        <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>CĐ Chung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payload?.by_campaign_table || []).map((row: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text)', maxWidth: '260px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.campaign_name}>
                              {row.campaign_name}
                            </div>
                            {row.campaign_id !== row.campaign_name && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{row.campaign_id}</div>
                            )}
                          </td>
                          <td style={{ padding: '10px 10px', color: 'var(--color-text)' }}>{row.project_name}</td>
                          <td style={{ padding: '10px 10px', color: 'var(--color-text-muted)' }}>{row.donvi_chay}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800 }}>{row.total_leads}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#EF4444' }}>{row.not_lead_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>
                            {row.ql_count} <span style={{ fontSize: '0.7rem', color: '#10B981' }}>({row.rates?.ql_rate || 0}%)</span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>{row.m_ql_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>{row.dong_y_gap_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#0891B2' }}>{row.s_ql_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#BD1D2D' }}>{row.giao_dich_count}</td>
                          <td style={{ padding: '10px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ color: '#BD1D2D', fontWeight: 700 }}>{row.temp_hot}</span>
                            {' / '}
                            <span style={{ color: '#F59E0B', fontWeight: 700 }}>{row.temp_warm}</span>
                            {' / '}
                            <span style={{ color: '#3B82F6', fontWeight: 700 }}>{row.temp_cold}</span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>{row.rates?.tuong_tac_lan_1 || 0}%</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right' }}>{row.rates?.ti_le_dot_lua || 0}%</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{row.rates?.ti_le_chot || 0}%</td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#BD1D2D' }}>{row.rates?.chuyen_doi_chung || 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 3: DOANH THU (`revenue`)                                         */}
      {/* =================================================================== */}
      {activeSubTab === 'revenue' && (
        <>
          {/* Revenue Top KPI Cards */}
          <div
            className="stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, minmax(0, 1fr))',
              gap: '0.875rem'
            }}
          >
            <div className="stat-card">
              <div className="stat-header" style={{ marginBottom: '6px' }}>
                <span className="stat-title">SỐ LƯỢNG GIAO DỊCH</span>
                <div className="stat-icon" style={{ background: 'rgba(189, 29, 45, 0.1)', color: '#BD1D2D' }}>
                  <Award size={15} />
                </div>
              </div>
              <div className="stat-value">{(kpis.total_transactions || 0).toLocaleString()}</div>
              <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Khách Đặt cọc: {kpis.dat_coc_contacts || 0} • Booking: {kpis.booking_contacts || 0}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header" style={{ marginBottom: '6px' }}>
                <span className="stat-title">TỔNG GIÁ TRỊ BĐS GIAO DỊCH</span>
                <div className="stat-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563EB' }}>
                  <Building2 size={15} />
                </div>
              </div>
              <div className="stat-value" title={formatVND(kpis.total_property_value || 0)}>
                {formatCompactVND(kpis.total_property_value || 0)}
              </div>
              <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {formatVND(kpis.total_property_value || 0)}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header" style={{ marginBottom: '6px' }}>
                <span className="stat-title">TỔNG TIỀN CỌC GHI NHẬN</span>
                <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#D97706' }}>
                  <Briefcase size={15} />
                </div>
              </div>
              <div className="stat-value" title={formatVND(kpis.total_deposit_amount || 0)}>
                {formatCompactVND(kpis.total_deposit_amount || 0)}
              </div>
              <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {formatVND(kpis.total_deposit_amount || 0)}
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '3px solid #10B981' }}>
              <div className="stat-header" style={{ marginBottom: '6px' }}>
                <span className="stat-title">TỔNG DOANH THU / HOA HỒNG</span>
                <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}>
                  <DollarSign size={15} />
                </div>
              </div>
              <div className="stat-value" style={{ color: '#10B981' }} title={formatVND(kpis.total_revenue_amount || 0)}>
                {formatCompactVND(kpis.total_revenue_amount || 0)}
              </div>
              <div className="stat-desc" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {formatVND(kpis.total_revenue_amount || 0)}
              </div>
            </div>
          </div>

          {/* 4 Revenue Breakdown Charts */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: '1.25rem'
            }}
          >
            {[
              { title: '1. Cơ Cấu Doanh Thu Theo Dự Án', data: payload?.by_project_chart || [] },
              { title: '2. Cơ Cấu Doanh Thu Theo Phân Loại Lead', data: payload?.by_phan_loai_chart || [] },
              { title: '3. Cơ Cấu Doanh Thu Theo Kênh', data: payload?.by_channel_chart || [] },
              { title: '4. Cơ Cấu Doanh Thu Theo Đơn Vị Chạy', data: payload?.by_donvi_chart || [] }
            ].map((box, idx) => (
              <div key={idx} className="card" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {box.title}
                </h4>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={box.data}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {box.data.map((_: any, i: number) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => [formatVND(Number(val)), 'Giá trị']} />
                      <Legend wrapperStyle={{ fontSize: '0.74rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          {/* Transactions Detail Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ marginBottom: '0.875rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Bảng Chi Tiết Giao Dịch & Doanh Thu
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Danh sách phiếu cọc & giao dịch phát sinh từ dữ liệu thực tế trên hệ thống
              </p>
            </div>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 800 }}>Mã GD</th>
                    <th style={{ padding: '10px 10px', fontWeight: 800 }}>Khách hàng</th>
                    <th style={{ padding: '10px 10px', fontWeight: 800 }}>Dự án / Mã căn</th>
                    <th style={{ padding: '10px 10px', fontWeight: 800 }}>Chiến dịch</th>
                    <th style={{ padding: '10px 10px', fontWeight: 800 }}>Loại Lead / Kênh</th>
                    <th style={{ padding: '10px 10px', fontWeight: 800 }}>Đơn vị chạy</th>
                    <th style={{ padding: '10px 10px', fontWeight: 800 }}>Sale phụ trách</th>
                    <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Giá trị BĐS</th>
                    <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right' }}>Tiền cọc</th>
                    <th style={{ padding: '10px 10px', fontWeight: 800, textAlign: 'right', color: '#10B981' }}>Doanh thu / HH</th>
                  </tr>
                </thead>
                <tbody>
                  {(payload?.transactions_table || []).length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Chưa có giao dịch nào trong khoảng bộ lọc này.
                      </td>
                    </tr>
                  ) : (
                    (payload?.transactions_table || []).map((tx: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#BD1D2D' }}>{tx.deposit_code}</td>
                        <td style={{ padding: '10px 10px', fontWeight: 700 }}>{tx.customer_name}</td>
                        <td style={{ padding: '10px 10px' }}>
                          <div style={{ fontWeight: 700 }}>{tx.project_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Căn: {tx.unit_code}</div>
                        </td>
                        <td style={{ padding: '10px 10px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.campaign_name}>
                          {tx.campaign_name}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <span style={{ fontWeight: 700 }}>{tx.lead_phan_loai}</span> • <span style={{ color: 'var(--color-text-muted)' }}>{tx.channel}</span>
                        </td>
                        <td style={{ padding: '10px 10px' }}>{tx.donvi_chay}</td>
                        <td style={{ padding: '10px 10px', fontWeight: 600 }}>{tx.sale_name}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600 }}>{formatVND(tx.property_value)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>{formatVND(tx.deposit_amount)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: '#10B981' }}>{formatVND(tx.revenue_amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
