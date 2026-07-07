import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Briefcase, Download, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line } from 'recharts';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../contexts/AuthContext';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { Skeleton, TableSkeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#0d9488', '#ec4899', '#f43f5e', '#a31422'];
const T_LABEL: Record<string, string> = {
  'call': 'Cuộc gọi',
  'email': 'Email',
  'meeting': 'Cuộc họp',
  'task': 'Công việc',
  'note': 'Ghi chú'
};

const MONTHLY: any[] = [];
const BY_OWNER: any[] = [];

const FMT = (n: any) => {
  const num = Number(n || 0);
  return num >= 1e9 ? (num / 1e9).toFixed(1) + 'T' : num >= 1e6 ? (num / 1e6).toFixed(0) + 'M' : num >= 1e3 ? (num / 1e3).toFixed(0) + 'K' : String(num);
};
const FMT_VND = (n: any) => {
  const num = Math.round(Number(n || 0));
  if (num >= 1e9) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num / 1e9) + ' Tỷ đ';
  }
  if (num >= 1e6) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(num / 1e6) + ' Tr đ';
  }
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};

export const ReportsPage: React.FC = () => {
  const { addToast } = useUIStore();
  const { user } = useAuth();
  const [tab, setTab] = useState<'sales' | 'pipeline' | 'customers' | 'companies' | 'expenses' | 'activities'>('sales');
  const [period, setPeriod] = useState<Period>('this_quarter');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('this_quarter'));
  
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any>(null);
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);

  const fetchSales = async () => {
    if (DEV_MODE) {
      setLoading(true);
      const state = getFilteredMockState();

      // Revenue = tổng value của deals đã chốt (stage_id === 'won')
      const wonDeals = (state.deals || []).filter((d: any) => d.stage_id === 'won');
      const wonValue = wonDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);

      // Tổng tất cả deals để tính thống kê
      const allDeals = state.deals || [];
      const totalDealValue = allDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);

      // Doanh thu theo owner
      const byOwner = state.users.map((u: any) => {
        const userDeals = allDeals.filter((d: any) => d.owner_id === u.id);
        return {
          id: u.id,
          name: u.full_name,
          deals: userDeals.length,
          revenue: userDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0)
        };
      }).filter((o: any) => o.deals > 0);

      // Sinh dữ liệu 8 tháng gần nhất với giá trị thực
      const BASE = totalDealValue > 0 ? totalDealValue / 8 : 500_000_000;
      const now = new Date();
      const byMonth = Array.from({ length: 8 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1);
        const label = `T${String(d.getMonth() + 1).padStart(2, '0')}`;
        const factor = 0.6 + (i / 7) * 0.8 + (Math.sin(i) * 0.1);
        return {
          month: label,
          revenue: Math.round(BASE * factor),
          cost: Math.round(BASE * (0.3 + (i / 7) * 0.2)),
        };
      });

      setSalesData({
        summary: {
          total_revenue: wonValue || totalDealValue * 0.3,
          revenue_change: '+12.4%',
          deals: allDeals.length,
          deals_change: '+5.2%',
          contacts: state.contacts.length,
          contacts_change: '+8.1%',
          win_rate: allDeals.length > 0 ? Math.round((wonDeals.length / allDeals.length) * 100) : 68,
          win_rate_change: '+2.5%'
        },
        by_month: byMonth,
        by_owner: byOwner
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get('/reports/sales', { params: { from: dateRange.from, to: dateRange.to } });
      setSalesData(r.data.data);
    } catch (e: any) {
      // silent fail — show empty charts
    } finally {
      setLoading(false);
    }
  };

  const fetchPipeline = async () => {
    if (DEV_MODE) {
      setLoading(true);
      const state = getFilteredMockState();
      setPipelineData(state.pipeline_stages.map((s: any) => ({
        stage: s.name,
        count: state.contacts.filter((c: any) => c.stage_id === s.id).length,
        total_value: state.contacts.filter((c: any) => c.stage_id === s.id).reduce((sum: number, c: any) => sum + (Number(c.expected_revenue) || 0), 0),
        color: s.color
      })));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get('/reports/pipeline', { params: { from: dateRange.from, to: dateRange.to } });
      const raw = r.data.data || [];
      const mapped = raw.map((item: any) => ({
        ...item,
        count: Number(item.count || 0),
        total_value: Number(item.total_value || 0)
      }));
      setPipelineData(mapped);
    } catch (e: any) {
      // silent fail
    } finally { setLoading(false); }
  };

  const fetchActivities = async () => {
    if (DEV_MODE) {
      setLoading(true);
      const state = getFilteredMockState();
      const types = ['call', 'email', 'meeting', 'task', 'note'];
      setActivityData({
        by_type: types.map(t => ({
          type: t,
          total: state.activities.filter((a: any) => a.type === t).length
        })),
        by_user_type: state.users.slice(0, 3).flatMap((u: any) => 
          types.map(t => ({
            user_name: u.full_name,
            type: t,
            total: Math.floor(Math.random() * 10) + 2
          }))
        )
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get('/reports/activities', { params: { from: dateRange.from, to: dateRange.to } });
      const raw = r.data.data;
      if (raw) {
        if (raw.by_type) raw.by_type = raw.by_type.map((item: any) => ({ ...item, total: Number(item.total || 0) }));
        if (raw.by_user_type) raw.by_user_type = raw.by_user_type.map((item: any) => ({ ...item, total: Number(item.total || 0) }));
      }
      setActivityData(raw);
    } catch (e: any) {
      console.error("Failed to fetch activities", e);
    } finally { setLoading(false); }
  };

  const fetchCustomers = async () => {
    if (DEV_MODE) {
      setLoading(true);
      const state = getFilteredMockState();
      setCustomerData({
        by_source: [
          { source: 'Facebook', count: 45 },
          { source: 'Website', count: 32 },
          { source: 'Referral', count: 18 },
          { source: 'Other', count: 5 }
        ],
        trend: [
          { date: '01/01', count: 5 },
          { date: '05/01', count: 12 },
          { date: '10/01', count: 8 },
          { date: '15/01', count: 15 }
        ],
        by_score: [
          { bucket: '0-20', count: 10 },
          { bucket: '21-40', count: 25 },
          { bucket: '41-60', count: 45 },
          { bucket: '61-80', count: 30 },
          { bucket: '81-100', count: 15 }
        ]
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get('/reports/customers', { params: { from: dateRange.from, to: dateRange.to } });
      const raw = r.data.data;
      if (raw) {
        if (raw.by_source) raw.by_source = raw.by_source.map((item: any) => ({ ...item, count: Number(item.count || 0) }));
        if (raw.by_score) raw.by_score = raw.by_score.map((item: any) => ({ ...item, count: Number(item.count || 0) }));
        if (raw.trend) raw.trend = raw.trend.map((item: any) => ({ ...item, count: Number(item.count || 0) }));
      }
      setCustomerData(raw);
    } catch (e: any) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const fetchCompanies = async () => {
    if (DEV_MODE) {
      setLoading(true);
      const state = getFilteredMockState();
      setCompanyData({
        by_industry: [
          { industry: 'Công nghệ', count: 25 },
          { industry: 'Sản xuất', count: 18 },
          { industry: 'Dịch vụ', count: 15 },
          { industry: 'Bán lẻ', count: 12 }
        ],
        by_size: [
          { size: 'Nhỏ (1-10)', count: 35 },
          { size: 'Vừa (11-50)', count: 20 },
          { size: 'Lớn (>50)', count: 15 }
        ],
        by_city: [
          { city: 'Hà Nội', count: 30 },
          { city: 'TP. HCM', count: 45 },
          { city: 'Đà Nẵng', count: 12 },
          { city: 'Hải Phòng', count: 8 }
        ]
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get('/reports/companies');
      const raw = r.data.data;
      if (raw) {
        if (raw.by_industry) raw.by_industry = raw.by_industry.map((item: any) => ({ ...item, count: Number(item.count || 0) }));
        if (raw.by_size) raw.by_size = raw.by_size.map((item: any) => ({ ...item, count: Number(item.count || 0) }));
        if (raw.by_city) raw.by_city = raw.by_city.map((item: any) => ({ ...item, count: Number(item.count || 0) }));
      }
      setCompanyData(raw);
    } catch (e: any) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const fetchExpenses = async () => {
    if (DEV_MODE) {
      setLoading(true);
      const state = getFilteredMockState();
      const totalExp = state.expenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      setExpenseData({
        by_category: [
          { category: 'Marketing', total: totalExp * 0.4 },
          { category: 'Vận hành', total: totalExp * 0.3 },
          { category: 'Nhân sự', total: totalExp * 0.2 },
          { category: 'Khác', total: totalExp * 0.1 }
        ],
        trend: [
          { date: '01/01', total: totalExp * 0.1 },
          { date: '05/01', total: totalExp * 0.2 },
          { date: '10/01', total: totalExp * 0.15 },
          { date: '15/01', total: totalExp * 0.25 }
        ]
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.get('/reports/expenses', { params: { from: dateRange.from, to: dateRange.to } });
      const raw = r.data.data;
      if (raw) {
        if (raw.by_category) raw.by_category = raw.by_category.map((item: any) => ({ ...item, total: Number(item.total || 0) }));
        if (raw.trend) raw.trend = raw.trend.map((item: any) => ({ ...item, total: Number(item.total || 0) }));
      }
      setExpenseData(raw);
    } catch (e: any) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'sales') fetchSales();
    else if (tab === 'pipeline') fetchPipeline();
    else if (tab === 'customers') fetchCustomers();
    else if (tab === 'companies') fetchCompanies();
    else if (tab === 'expenses') fetchExpenses();
    else if (tab === 'activities') fetchActivities();
  }, [tab, dateRange]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Báo cáo & Phân tích</h1>
          {((user?.role as any) === 'sale' || (user?.role as any) === 'sales') ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span className="page-subtitle" style={{ margin: 0 }}>Dữ liệu của</span>
              <Avatar name={(user as any)?.full_name || 'Sale'} src={(user as any)?.avatar_url} size={22} />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{(user as any)?.full_name}</span>
            </div>
          ) : (
            <p className="page-subtitle">Dữ liệu tổng hợp toàn hệ thống</p>
          )}
        </div>
        <div className="flex gap-2">
          <PeriodFilter value={period} onChange={(p, r) => { setPeriod(p); setDateRange(r); }} />
          <button className="btn secondary" onClick={() => {
            addToast('Đang tạo báo cáo PDF...', 'info');
            setTimeout(() => window.print(), 1000);
          }}><Download size={16} /> Xuất PDF</button>
        </div>
      </div>

      {/* Tabs */}
      {(() => {
        const TABS = [
          { key: 'sales', label: 'Doanh thu' },
          { key: 'pipeline', label: 'Pipeline' },
          { key: 'customers', label: 'Khách hàng' },
          { key: 'companies', label: 'Doanh nghiệp' },
          { key: 'expenses', label: 'Chi phí' },
          { key: 'activities', label: 'Hoạt động' }
        ];
        const activeTabIndex = TABS.findIndex(t => t.key === tab);
        return (
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.05)',
            padding: '4px',
            borderRadius: '12px',
            gap: '4px',
            width: 'fit-content',
            position: 'relative',
            border: '1px solid var(--color-border-light)',
            alignSelf: 'flex-start',
            marginBottom: '1.5rem'
          }}>
            {/* Sliding Pill Background Indicator */}
            <div style={{
              position: 'absolute',
              top: '4px',
              bottom: '4px',
              width: '110px',
              borderRadius: '10px',
              background: 'var(--color-surface)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: `translateX(${activeTabIndex * (110 + 4)}px)`,
              zIndex: 1
            }} />
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                style={{
                  width: '110px',
                  height: '36px',
                  border: 'none',
                  outline: 'none',
                  background: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  position: 'relative',
                  zIndex: 2,
                  transition: 'color 0.25s'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        );
      })()}

      {tab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* KPI Cards */}
          <div className="grid grid-4">
            {[
              { label: 'Tổng doanh thu', value: FMT_VND(salesData?.summary?.total_revenue || 0), change: salesData?.summary?.revenue_change, up: (salesData?.summary?.revenue_change || '').startsWith('+'), icon: TrendingUp, color: '#a31422' },
              { label: 'Cơ hội bán hàng', value: String(salesData?.summary?.deals || 0), change: salesData?.summary?.deals_change, up: (salesData?.summary?.deals_change || '').startsWith('+'), icon: Briefcase, color: '#10b981' },
              { label: 'Khách hàng', value: String(salesData?.summary?.contacts || 0), change: salesData?.summary?.contacts_change, up: (salesData?.summary?.contacts_change || '').startsWith('+'), icon: Users, color: '#3b82f6' },
              { label: 'Tỷ lệ chốt deal', value: `${salesData?.summary?.win_rate || 0}%`, change: salesData?.summary?.win_rate_change, up: (salesData?.summary?.win_rate_change || '').startsWith('+'), icon: BarChart3, color: '#f59e0b' },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div key={card.label} className="stat-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <div className="stat-kpi__header">
                    <div className="stat-kpi__label">{card.label}</div>
                    <div className="stat-kpi__icon" style={{ color: card.color }}><Icon size={20} /></div>
                  </div>
                  {loading ? (
                    <div style={{ padding: '0.5rem 0' }}>
                      <Skeleton height="2rem" width="80%" style={{ marginBottom: '0.5rem' }} />
                      <Skeleton height="0.875rem" width="60%" />
                    </div>
                  ) : (
                    <>
                      <div className="stat-kpi__value">{card.value}</div>
                      {card.change && (
                        <div className="stat-kpi__sub">
                          <span className={`stat-kpi__change ${card.up ? 'up' : 'down'}`}>
                            {card.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {card.change}
                          </span>
                          <span style={{color:'var(--color-text-muted)', fontSize:'0.7rem'}}>so với kỳ trước</span>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Revenue chart */}
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Doanh thu vs Chi phí</h3>
            <p className="text-xs text-light mb-4">So sánh doanh thu thực tế với chi phí vận hành</p>
            {loading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: '1.25rem', padding: '1rem' }}>
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={`${((i * 13) % 40) + 40}%`} width="100%" />)}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={salesData?.by_month || MONTHLY} margin={{ left: -10 }}>
                  <defs>
                    <linearGradient id="colorSalesRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a31422" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#7e0e17" stopOpacity={1}/>
                    </linearGradient>
                    <linearGradient id="colorSalesCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#ea580c" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={FMT} tick={{ fontSize: 9, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip cursor={false} formatter={(v: any, name: any) => [FMT_VND(Number(v || 0)), name]}
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', marginTop: '6px' }} />
                  <Bar dataKey="revenue" name="Doanh thu" fill="url(#colorSalesRevenue)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="cost" name="Chi phí" fill="url(#colorSalesCost)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By owner table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontWeight: 700 }}>Hiệu suất theo nhân viên</h3>
            </div>
            {loading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Nhân viên</th><th>Số Deal</th><th>Doanh thu</th><th>% Đóng góp</th></tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows = salesData?.by_owner || BY_OWNER;
                      const total = rows.reduce((s: number, o: any) => s + Number(o.revenue || 0), 0);
                      return rows.map((o: any) => {
                        const pct = total > 0 ? Math.round((Number(o.revenue || 0) / total) * 100) : 0;
                        return (
                          <tr key={o.id || o.user_id || o.name || o.user_name}>
                            <td>
                              <div className="flex items-center gap-2">
                                <Avatar name={o.name || o.user_name || 'U'} size={28} />
                                <span style={{ fontWeight: 600 }}>{o.name || o.user_name || 'Unknown'}</span>
                              </div>
                            </td>
                            <td><span className="badge purple">{o.deals || o.total_deals || 0} deals</span></td>
                            <td className="font-semi" style={{ color: 'var(--color-primary)' }}>{FMT_VND(Number(o.revenue || 0))}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ flex: 1, height: 7, background: 'var(--color-border)', borderRadius: 4 }}>
                                  <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 4 }} />
                                </div>
                                <span className="text-sm font-semi" style={{ minWidth: 36 }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* KPI Cards */}
          <div className="grid grid-3">
            {[
              {
                label: 'Giá trị trung bình mỗi deal',
                value: FMT_VND(pipelineData.reduce((s,d) => s+Number(d.total_value),0) / (pipelineData.reduce((s,d) => s+Number(d.count),0) || 1)),
                icon: TrendingUp,
                color: '#a31422'
              },
              {
                label: 'Tổng cơ hội đang mở',
                value: String(pipelineData.reduce((s,d) => s+Number(d.count),0)),
                icon: Briefcase,
                color: '#10b981'
              },
              {
                label: 'Tổng giá trị Pipeline',
                value: FMT_VND(pipelineData.reduce((s,d) => s+Number(d.total_value),0)),
                icon: BarChart3,
                color: '#3b82f6'
              }
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div key={card.label} className="stat-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <div className="stat-kpi__header">
                    <div className="stat-kpi__label">{card.label}</div>
                    <div className="stat-kpi__icon" style={{ color: card.color }}><Icon size={20} /></div>
                  </div>
                  {loading ? (
                    <div style={{ padding: '0.5rem 0' }}>
                      <Skeleton height="2rem" width="80%" style={{ marginBottom: '0.5rem' }} />
                    </div>
                  ) : (
                    <div className="stat-kpi__value">{card.value}</div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-2" style={{ gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="var(--color-primary)" />
                Phễu chuyển đổi (Conversion Funnel)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                {(() => {
                  const data = pipelineData.length ? pipelineData : [];
                  const maxVal = Math.max(...data.map((d: any) => d.count)) || 1;
                  
                  return data.map((s: any, idx: number) => {
                    const width = (s.count / maxVal) * 100;
                    const nextS = data[idx+1];
                    const hasDropoff = nextS !== undefined;
                    const dropoff = (nextS && s.count > 0) ? Math.round((nextS.count / s.count) * 100) : null;
                    
                    return (
                      <React.Fragment key={s.stage}>
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>{s.stage}</span>
                          </div>
                          <div style={{ width: '220px', display: 'flex', justifyContent: 'center' }}>
                            <motion.div 
                              initial={{ width: 0 }} animate={{ width: `${width}%` }}
                              style={{ height: '26px', background: s.color || 'var(--color-primary)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '0.75rem', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                            >
                              {s.count}
                            </motion.div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 500 }}>{FMT_VND(s.total_value)}</span>
                          </div>
                        </div>
                        {hasDropoff && (
                          <div style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                            Tỷ lệ chuyển đổi: <span style={{ color: dropoff === null ? 'var(--color-text-muted)' : (dropoff < 50 ? 'var(--color-danger)' : 'var(--color-success)'), marginLeft: '4px', fontWeight: 600 }}>{dropoff !== null ? `${dropoff}%` : '—'}</span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
               <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>Phân bổ theo giai đoạn</h3>
               <div style={{ height: 200 }}>
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie data={pipelineData} dataKey="count" nameKey="stage" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4}>
                        {pipelineData.map((s: any, i: number) => (
                           <Cell key={`cell-${i}`} fill={s.color || COLORS[i % COLORS.length]} />
                        ))}
                       </Pie>
                       <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                       <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', fontWeight: 500 }} />
                    </PieChart>
                 </ResponsiveContainer>
               </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="grid grid-2" style={{ gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Nguồn khách hàng</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={customerData?.by_source || []} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4}>
                      {(customerData?.by_source || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Tăng trưởng khách hàng mới</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={customerData?.trend || []}>
                    <defs>
                      <linearGradient id="colorCustomerGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip cursor={false} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                    <Bar dataKey="count" fill="url(#colorCustomerGrowth)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Phân bổ theo Lead Score</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerData?.by_score || []}>
                  <defs>
                    <linearGradient id="colorCustomerScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#3730a3" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                  <XAxis dataKey="bucket" label={{ value: 'Điểm tiềm năng', position: 'insideBottom', offset: -5, style: { fontSize: 10, fill: 'var(--color-text-light)' } }} tick={{ fontSize: 10 }} />
                  <YAxis label={{ value: 'Số lượng', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'var(--color-text-light)' } }} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={false} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                  <Bar dataKey="count" fill="url(#colorCustomerScore)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'companies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="grid grid-2" style={{ gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Phân loại theo lĩnh vực</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={companyData?.by_industry || []} dataKey="count" nameKey="industry" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4}>
                      {(companyData?.by_industry || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Quy mô doanh nghiệp</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={companyData?.by_size || []} dataKey="count" nameKey="size" cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4}>
                      {(companyData?.by_size || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Top 10 thành phố</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companyData?.by_city || []} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="city" type="category" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} width={80} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="grid grid-2" style={{ gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Cơ cấu chi phí</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={expenseData?.by_category || []} 
                      dataKey="total" 
                      nameKey="category" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={50}
                      outerRadius={70} 
                      paddingAngle={4}
                    >
                      {(expenseData?.by_category || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => FMT_VND(Number(v))} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Biến động chi phí theo ngày</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={expenseData?.trend || []}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} />
                    <YAxis tickFormatter={FMT} tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} />
                    <Tooltip formatter={(v: any) => FMT_VND(Number(v))} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                    <Area type="monotone" dataKey="total" stroke="#ef4444" fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Chi phí vs Doanh thu (Kết hợp)</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={salesData?.by_month || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} />
                  <YAxis tickFormatter={FMT} tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} />
                  <Tooltip formatter={(v: any) => FMT_VND(Number(v))} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', fontWeight: 500 }} />
                  <Bar dataKey="revenue" name="Doanh thu" fill="#a31422" radius={[4, 4, 0, 0]} maxBarSize={12} />
                  <Line type="monotone" dataKey="cost" name="Chi phí" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'activities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="grid grid-2">
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem' }}>Phân bổ loại hoạt động</h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={activityData?.by_type || []} 
                      dataKey="total" 
                      nameKey="type" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={50}
                      outerRadius={70} 
                      paddingAngle={4}
                    >
                      {(activityData?.by_type || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '0.75rem', fontWeight: 500 }} formatter={(v) => T_LABEL[v as string] || v} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Tóm tắt hoạt động nhân viên</h3>
              <div className="table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Nhân viên</th><th>Tổng</th></tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const userTotals: any = {};
                      (activityData?.by_user_type || []).forEach((a: any) => {
                        userTotals[a.user_name] = (userTotals[a.user_name] || 0) + Number(a.total);
                      });
                      return Object.entries(userTotals).map(([name, total]: [any, any]) => (
                        <tr key={name}>
                          <td>
                            <div className="flex items-center gap-2">
                              <Avatar name={name} size={24} />
                              <span style={{ fontWeight: 600 }}>{name}</span>
                            </div>
                          </td>
                          <td><span className="badge info">{total}</span></td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontWeight: 700 }}>Chi tiết hoạt động theo loại</h3>
            </div>
            <div className="table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Nhân viên</th><th>Cuộc gọi</th><th>Email</th><th>Cuộc họp</th><th>Task</th><th>Ghi chú</th><th>Tổng</th></tr>
                </thead>
                  <tbody>
                    {(() => {
                      const grouped: any = {};
                      (activityData?.by_user_type || []).forEach((a: any) => {
                        if (!grouped[a.user_name]) grouped[a.user_name] = { name: a.user_name, call: 0, email: 0, meeting: 0, task: 0, note: 0, total: 0 };
                        grouped[a.user_name][a.type] = (grouped[a.user_name][a.type] || 0) + Number(a.total);
                        grouped[a.user_name].total += Number(a.total);
                      });
                      
                      const rows = Object.values(grouped);
                      if (rows.length === 0) return (<tr><td colSpan={7} style={{textAlign:'center', padding:'2rem', color:'var(--color-text-muted)'}}>Không có dữ liệu trong khoảng thời gian này</td></tr>);

                      return rows.map((r: any) => (
                        <tr key={r.name}>
                          <td>
                            <div className="flex items-center gap-2">
                              <Avatar name={r.name} size={28} />
                              <span style={{ fontWeight: 600 }}>{r.name}</span>
                            </div>
                          </td>
                          <td><span className="badge info">{r.call}</span></td>
                          <td><span className="badge purple">{r.email}</span></td>
                          <td><span className="badge warning">{r.meeting}</span></td>
                          <td><span className="badge success">{r.task}</span></td>
                          <td><span className="badge secondary">{r.note}</span></td>
                          <td><span style={{ fontWeight: 700 }}>{r.total}</span></td>
                        </tr>
                      ));
                    })()}
                  </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
