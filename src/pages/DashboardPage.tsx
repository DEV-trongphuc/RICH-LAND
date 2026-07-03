import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, Users, DollarSign, Download, Trophy,
  AlertTriangle, Tag as TagIcon, ShoppingCart, RefreshCw,
  Zap, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, ComposedChart, Area, AreaChart
} from 'recharts';
import api from '../api/axios';
import styles from './DashboardPage.module.css';
import { motion } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { Skeleton } from '../components/ui/Skeleton';

const FMT = (n: any) => {
  const num = Number(n || 0);
  return num >= 1e9 ? (num / 1e9).toFixed(1) + 'T' : num >= 1e6 ? (num / 1e6).toFixed(0) + 'M' : num >= 1e3 ? (num / 1e3).toFixed(0) + 'K' : String(num);
};
const FMT_VND = (n: any) => {
  const num = Number(n || 0);
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(num);
};

const MOCK_STATS = {
  won_value: 0,
  profit: 0,
  new_contacts: 0,
  expenses: 0,
  tasks_due_today: 0
};

/* ── Component ──────────────────────────────────────────────── */
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [pipelineFunnel, setPipelineFunnel] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [tagStats, setTagStats] = useState<any[]>([]);
  const [inventoryStats, setInventoryStats] = useState<any>(null);
  const [period, setPeriod] = useState<Period>('this_month');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('this_month'));
  const [loadingStats, setLoadingStats] = useState(true);
  const [activityIndex, setActivityIndex] = useState(0);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ITEMS_PER_PAGE = isMobile ? 1 : 4;

  const fetchAll = useCallback(async () => {
    if (DEV_MODE) {
      setLoadingStats(true);
      const state = getFilteredMockState();
      
      // Compute stats from mock data
      const activeDeals = state.deals.filter((d: any) => d.stage_id !== 'won' && d.stage_id !== 'lost');
      const wonDeals = state.deals.filter((d: any) => d.stage_id === 'won');
      const wonValue = wonDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);
      const activeValue = activeDeals.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);
      const expenses = (state.expenses || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      
      setStats({
        won_value: wonValue,
        gross_profit: wonValue * 0.4,
        profit: wonValue - expenses,
        new_contacts: state.contacts.length,
        total_contacts: state.contacts.length * 12,
        expenses: expenses,
        tasks_due_today: state.activities.filter((a: any) => a.status === 'planned').length,
        active_deals: activeDeals.length,
        active_value: activeValue,
        revenue_change: '+18.5%',
        profit_change: '+12.4%',
        contacts_change: '+5.2%',
        expenses_change: '-2.1%',
        today_tasks: state.activities.filter((a: any) => a.status === 'planned')
      });

      setRevenueChart([
        { month: 'T06', revenue: wonValue * 0.45, cost: expenses * 0.5 },
        { month: 'T07', revenue: wonValue * 0.55, cost: expenses * 0.6 },
        { month: 'T08', revenue: wonValue * 0.5, cost: expenses * 0.55 },
        { month: 'T09', revenue: wonValue * 0.65, cost: expenses * 0.7 },
        { month: 'T10', revenue: wonValue * 0.75, cost: expenses * 0.8 },
        { month: 'T11', revenue: wonValue * 0.85, cost: expenses * 0.9 },
        { month: 'T12', revenue: wonValue * 0.95, cost: expenses * 0.85 },
        { month: 'T01', revenue: wonValue, cost: expenses }
      ]);

      setPipelineFunnel(state.pipeline_stages.map((s: any) => ({
        ...s,
        deal_count: state.contacts.filter((c: any) => c.stage_id === s.id).length,
        total_value: state.contacts.filter((c: any) => c.stage_id === s.id).reduce((sum: number, c: any) => sum + (Number(c.expected_revenue) || 0), 0)
      })));

      setLeadSources([
        { source: 'Facebook', count: 45, color: '#3b82f6' },
        { source: 'Website', count: 32, color: '#10b981' },
        { source: 'Referral', count: 18, color: '#BD1D2D' },
        { source: 'Other', count: 5, color: '#6b7280' }
      ]);

      setLeaderboard(state.users.slice(0, 3).map((u: any, i: number) => ({
        ...u,
        won_value: wonValue * (0.5 - i * 0.1),
        won_count: 5 - i
      })));

      setTagStats(state.tags.map((t: any) => ({
        tag: t.name,
        count: t.count || 0,
        color: t.color
      })));

      setInventoryStats({
        total_value: 1250000000,
        total_batches: 45
      });

      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);

    try {
      const [s, rev, pipe, src, lead, tags, inventory] = await Promise.all([
        api.get('/dashboard/stats', { params: { from: dateRange.from, to: dateRange.to } }),
        api.get('/dashboard/chart-revenue', { params: { months: 8 } }),
        api.get('/dashboard/pipeline-funnel'),
        api.get('/dashboard/lead-sources', { params: { from: dateRange.from, to: dateRange.to } }),
        api.get('/dashboard/sales-leaderboard', { params: { from: dateRange.from, to: dateRange.to } }),
        api.get('/tags/stats', { params: { from: dateRange.from, to: dateRange.to } }),
        api.get('/reports/inventory'),
      ]);
      setStats(s.data.data || MOCK_STATS);
      setRevenueChart((rev.data.data || []).map((x: any) => ({
        ...x,
        revenue: Number(x.revenue || 0),
        cost: Number(x.cost || 0)
      })));
      setPipelineFunnel((pipe.data.data || []).map((x: any) => ({
        ...x,
        deal_count: Number(x.deal_count || 0),
        total_value: Number(x.total_value || 0)
      })));
      const srcColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#0d9488', '#BD1D2D'];
      const srcData = (src.data.data || []).map((x: any, i: number) => ({
        ...x,
        count: Number(x.count || 0),
        color: srcColors[i % srcColors.length]
      }));
      setLeadSources(srcData);
      setLeaderboard((lead.data.data || []).map((x: any) => ({
        ...x,
        won_value: Number(x.won_value || 0),
        won_count: Number(x.won_count || 0)
      })));
      setTagStats((tags.data.data || []).slice(0, 12).map((x: any) => ({
        ...x,
        count: Number(x.count || 0)
      })));
      setInventoryStats(inventory.data.data);
    } catch (e: any) {
      setStats(null);
      setRevenueChart([]);
      setPipelineFunnel([]);
      setLeadSources([]);
      setLeaderboard([]);
      setTagStats([]);
    } finally {
      setLoadingStats(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setActivityIndex(0); }, [dateRange]);

  const margin = stats?.won_value > 0 ? (stats?.profit / stats?.won_value) * 100 : 0;

  const kpiCards = [
    {
      id: 'leads',
      label: 'Khách hàng mới',
      value: (stats?.new_contacts ?? 0).toString(),
      icon: Users,
      color: '#3b82f6',
      change: stats?.contacts_change,
      up: (stats?.contacts_change || '').startsWith('+'),
      extra: (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
            <span>Tổng khách hàng:</span>
            <span style={{ fontWeight: 600 }}>{stats?.total_contacts ?? 0}</span>
          </div>
        </div>
      )
    },
    {
      id: 'revenue',
      label: 'Doanh thu',
      value: FMT_VND(stats?.won_value ?? 0),
      icon: DollarSign,
      color: '#a31422',
      change: stats?.revenue_change,
      up: (stats?.revenue_change || '').startsWith('+'),
      extra: (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
            <span>Lợi nhuận gộp:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{FMT_VND(stats?.gross_profit ?? 0)}</span>
          </div>
        </div>
      )
    },
    {
      id: 'profit',
      label: 'Lợi nhuận ròng',
      value: FMT_VND(stats?.profit ?? 0),
      icon: TrendingUp,
      color: '#10b981',
      change: stats?.profit_change,
      up: (stats?.profit_change || '').startsWith('+'),
      extra: (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', marginBottom: '4px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            <span>Biên lợi nhuận</span>
            <span style={{ color: margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{margin.toFixed(1)}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, margin))}%` }}
              style={{ height: '100%', background: margin >= 20 ? 'var(--color-success)' : margin > 0 ? 'var(--color-primary)' : 'var(--color-danger)', borderRadius: 'var(--radius-sm)' }} 
            />
          </div>
        </div>
      )
    },
    {
      id: 'expenses',
      label: 'Chi phí & Thất thoát',
      value: FMT_VND((stats?.expenses ?? 0) + (stats?.inventory_loss ?? 0) + (stats?.shop_paid_shipping ?? 0)),
      icon: AlertTriangle,
      color: '#ef4444',
      change: stats?.expenses_change,
      up: !(stats?.expenses_change || '').startsWith('+'),
      extra: (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
            <span>Chi phí vận hành:</span>
            <span style={{ fontWeight: 700 }}>{FMT_VND(stats?.expenses ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
            <span>Phí ship shop chịu:</span>
            <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{FMT_VND(stats?.shop_paid_shipping ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
            <span>Thất thoát kho:</span>
            <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{FMT_VND(stats?.inventory_loss ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '4px', marginTop: '2px' }}>
            <span>Giá trị hàng tồn:</span>
            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{FMT_VND(inventoryStats?.total_value ?? 0)}</span>
          </div>
        </div>
      )
    },
  ];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Báo cáo Tổng quan</h1>
          <p className="page-subtitle">Phân tích hiệu suất kinh doanh đến {new Date().toLocaleDateString('vi-VN')}</p>
        </div>
        <div className="flex gap-3">
          <PeriodFilter
            value={period}
            onChange={(p, r) => { setPeriod(p); setDateRange(r); }}
          />
          <button
            className="btn outline"
            onClick={fetchAll}
            disabled={loadingStats}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={16} style={{ animation: loadingStats ? 'spin 1s linear infinite' : 'none' }} />
            Làm mới
          </button>
          <button className="btn outline"><Download size={18} /> Xuất PDF</button>
        </div>
      </div>

      {/* Alert / Today's Focus */}
      {(() => {
        const tasksToday = (stats?.today_tasks || []);

        if (tasksToday.length === 0 && (stats?.tasks_due_today ?? 0) === 0) return null;

        return (
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(163, 20, 34, 0.08), rgba(189, 29, 45, 0.08))', border: '1px solid rgba(163, 20, 34, 0.15)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 36, height: 36, background: 'var(--color-primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap size={18} color="white" fill="white" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--color-primary)' }}>Tiêu điểm công việc hôm nay</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                  Có <strong>{tasksToday.length}</strong> hoạt động cần bạn xử lý trong ngày {new Date().toLocaleDateString('vi-VN')}
                  {stats?.overdue_tasks > 0 && <span style={{ color: 'var(--color-danger)', fontWeight: 700, marginLeft: '8px' }}>• {stats.overdue_tasks} việc quá hạn cần xử lý gấp!</span>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginRight: '1rem' }}>
                <button 
                  className="btn outline sm icon-only" 
                  disabled={activityIndex === 0}
                  onClick={() => setActivityIndex(Math.max(0, activityIndex - 1))}
                  style={{ borderRadius: '50%', width: 32, height: 32, padding: 0 }}
                >
                  <ChevronLeftIcon size={16} />
                </button>
                <button 
                  className="btn outline sm icon-only" 
                  disabled={activityIndex + ITEMS_PER_PAGE >= tasksToday.length}
                  onClick={() => setActivityIndex(Math.min(tasksToday.length - ITEMS_PER_PAGE, activityIndex + 1))}
                  style={{ borderRadius: '50%', width: 32, height: 32, padding: 0 }}
                >
                  <ChevronRightIcon size={16} />
                </button>
              </div>
              <button className="btn ghost sm" onClick={() => navigate('/activities')} style={{ color: 'var(--color-primary)', fontWeight: 700 }}>Tất cả hoạt động →</button>
            </div>

            {tasksToday.length > 0 && (
              <div className={styles.focusRow}>
                {tasksToday.slice(activityIndex, activityIndex + ITEMS_PER_PAGE).map((task: any) => (
                  <motion.div
                    key={task.id}
                    whileHover={{ y: -4, boxShadow: 'var(--shadow-lg)' }}
                    onClick={() => navigate('/activities')}
                    style={{
                      minWidth: 280,
                      padding: '1.25rem',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow-sm)',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: task.priority === 'high' ? '#ef4444' : '#a31422' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--color-bg)', color: '#a31422', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={16} />
                      </div>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        {task.due_date ? new Date(task.due_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Cả ngày'}
                      </span>
                      <span className="badge" style={{ fontSize: '0.65rem', marginLeft: 'auto', background: 'var(--color-bg)', color: '#a31422', border: 'none' }}>{task.type}</span>
                    </div>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.subject}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Zap size={12} /> {task.priority === 'high' ? 'Ưu tiên cao' : 'Bình thường'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>Mở →</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* KPI Cards — Simple & Standard */}
      <div className={`grid ${styles.kpiGrid}`} style={{ marginBottom: '1.5rem' }}>
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={i}
              className={`stat-card hover-lift ${card.id}-card`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                if (card.id === 'leads' || card.label.includes('Lead')) navigate('/contacts');
                if (card.id === 'revenue' || card.label.includes('Doanh thu')) navigate('/reports');
                if (card.id === 'expenses' || card.label.includes('Chi phí')) {
                  navigate('/expenses', { state: { period, dateRange } });
                }
                if (card.id === 'profit' || card.label.includes('Lợi nhuận')) navigate('/reports');
              }}
              style={{ cursor: 'pointer', minHeight: '110px', display: 'flex', flexDirection: 'column' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="stat-label">{card.label}</span>
                <div style={{ color: card.color, opacity: 0.8 }}><Icon size={20} /></div>
              </div>
              
              {loadingStats ? (
                <Skeleton height="2rem" width="80%" />
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="stat-value" style={{ fontSize: '1.5rem' }}>{card.value}</div>
                  <div className={`stat-change ${card.up !== false ? 'up' : 'down'}`} style={{ marginBottom: card.extra ? '0' : '0.5rem' }}>
                    {card.up !== false ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {card.change || '+0%'}
                    <span style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 400 }}>so với kỳ trước</span>
                  </div>
                  {card.extra}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Revenue chart + Pipeline */}
      <div className={styles.chartsRow}>
        {/* Revenue */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Hiệu suất doanh thu</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '2px' }}>8 tháng gần nhất — đường Doanh thu vs Chi phí</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, background: '#a31422', borderRadius: 2 }}></span>Doanh thu</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2, opacity: 0.7 }}></span>Chi phí</span>
            </div>
          </div>
          {loadingStats ? (
            <div style={{ height: isMobile ? 180 : 260, display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={`${((i * 17) % 60) + 20}%`} width="100%" />)}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 180 : 240}>
              <ComposedChart data={revenueChart} margin={{ left: -10, right: 5 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDashboardCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.75}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={FMT} tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={42} />
                <Tooltip 
                  cursor={false}
                  formatter={(v: any, name: any) => [FMT_VND(Number(v || 0)), name]} 
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '0.8125rem' }}
                  labelStyle={{ color: 'var(--color-text)', fontWeight: 700 }}
                  itemStyle={{ color: 'var(--color-primary)' }}
                />
                <Area type="monotone" name="Doanh thu" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={3} fill="url(#revGrad)" dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                <Bar dataKey="cost" name="Chi phí" fill="url(#colorDashboardCost)" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pipeline stages */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Pipeline Stages</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginBottom: '1rem' }}>Số deal & giá trị theo giai đoạn</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pipelineFunnel.map((stage: any) => {
              const maxCount = Math.max(...pipelineFunnel.map((s: any) => Number(s.deal_count)));
              const pct = maxCount > 0 ? (Number(stage.deal_count) / maxCount * 100) : 0;
              return (
                <div key={stage.id || stage.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{stage.name}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{stage.deal_count} · {FMT(Number(stage.total_value))}</span>
                  </div>
                  <div style={{ height: 7, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: stage.color || '#a31422', borderRadius: 4, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3-column row: Leaderboard + Lead Sources + Activities */}
      <div className={styles.bottomRow}>

        {/* Sales Leaderboard */}
        {user?.role !== 'sale' && user?.role !== 'sales' && (
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '0.25rem' }}>
              <Trophy size={16} color="var(--color-warning)" /> Top Sales
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginBottom: '1rem' }}>Doanh thu kỳ được chọn</p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leaderboard.map((sale: any, i: number) => (
                <div key={sale.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: i < leaderboard.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={sale.full_name} src={sale.avatar_url} size={38} />
                    <div style={{ position: 'absolute', top: -5, right: -5, width: 20, height: 20, background: i === 0 ? 'var(--color-primary)' : i === 1 ? '#BD1D2D' : 'var(--color-border)', color: i < 2 ? 'white' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.65rem', borderRadius: '50%', border: '2px solid white', boxShadow: 'var(--shadow-sm)', zIndex: 1 }}>
                      {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.3 }}>{sale.full_name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{sale.won_count || 0} deals chốt</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.875rem' }}>{FMT(Number(sale.won_value || 0))}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lead Sources donut */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '0.25rem' }}>
            <Users size={16} color="var(--color-primary)" /> Nguồn khách hàng
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>Kỳ được chọn</p>
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
            <PieChart>
              <Pie data={leadSources} nameKey="source" dataKey="count" cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4}>
                {leadSources.map((_: any, i: number) => <Cell key={i} fill={leadSources[i]?.color || 'var(--color-primary)'} />)}
              </Pie>
              <Tooltip 
                formatter={(v: any, _: any, entry: any) => [`${v} liên hệ`, entry.payload.source]} 
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', fontSize: '0.8125rem' }}
                itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.25rem' }}>
            {leadSources.map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, flex: 1 }}>{s.source}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tag Stats chart */}
        {user?.role !== 'sale' && user?.role !== 'sales' && (
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <TagIcon size={16} color="var(--color-primary)" /> Thống kê Tags
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '2px' }}>Leads có tag theo kỳ được chọn</p>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>
                {tagStats.reduce((s: number, t: any) => s + t.count, 0)} tag-lead
              </span>
            </div>

            {loadingStats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                {[80, 60, 45, 35, 25].map((w, i) => <Skeleton key={i} height="28px" width={`${w}%`} />)}
              </div>
            ) : tagStats.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', gap: '0.5rem' }}>
                <TagIcon size={32} style={{ opacity: 0.3 }} />
                <span>Chưa có tag nào trong kỳ này</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 180 : Math.max(180, tagStats.length * 34)}>
                <BarChart data={tagStats} layout="vertical" margin={{ left: 4, right: 30, top: 2, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="tag" tick={{ fontSize: 11, fill: 'var(--color-text)', fontWeight: 600 }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={false}
                    formatter={(v: any) => [v + ' lead', 'Số lead']}
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', fontSize: '0.8125rem' }}
                    labelStyle={{ color: 'var(--color-text)', fontWeight: 700 }}
                    itemStyle={{ color: 'var(--color-primary)' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {tagStats.map((entry, i) => <Cell key={i} fill={entry.color || 'var(--color-primary)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
