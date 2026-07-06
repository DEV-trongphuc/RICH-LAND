import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DollarSign, Plus, Search, Download, Truck, Coffee, Home,
  Briefcase, CreditCard, Tag, Eye, Pencil, Trash2, Loader2,
  CheckCircle2, Clock, TrendingDown, X, ArrowUpRight, ArrowDownRight, ChevronDown, Building2, Wallet, User,
  Upload, Paperclip
} from 'lucide-react';
import { compressToWebP } from '../utils/imageCompress';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUIStore } from '../store/uiStore';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { Pagination } from '../components/ui/Pagination';
import { numberToVietnameseText } from '../utils/numberToText';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import api from '../api/axios';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { Tooltip } from '../components/ui/Tooltip';

const PAGE_SIZE = 10;

const MOCK_EXPENSES: any[] = [
  { id: 1, title: 'Thuê văn phòng tháng 6', amount: 15000000, date: '2026-05-01', category: 'Vận hành', creator_name: 'Admin', status: 'approved', vendor_name: 'Minh House', has_vat_invoice: true, is_vat_inclusive: true },
  { id: 2, title: 'Tiền điện nước T5', amount: 2450000, date: '2026-05-05', category: 'Vận hành', creator_name: 'Kế toán', status: 'pending', vendor_name: 'EVN/VWA', has_vat_invoice: true, is_vat_inclusive: true },
  { id: 3, title: 'Chạy quảng cáo Facebook Ads', amount: 8000000, date: '2026-05-03', category: 'Marketing', creator_name: 'Marketing Dept', status: 'approved', vendor_name: 'Facebook Ireland', has_vat_invoice: false, is_vat_inclusive: true },
  { id: 4, title: 'Mua máy pha cà phê mới', amount: 4200000, date: '2026-05-04', category: 'Vận hành', creator_name: 'Admin', status: 'pending', vendor_name: 'Coffee Store', has_vat_invoice: true, is_vat_inclusive: false },
  { id: 5, title: 'Grab công tác gặp khách hàng', amount: 320000, date: '2026-05-05', category: 'Di chuyển', creator_name: 'Sale A', status: 'approved', vendor_name: 'Grab Vietnam', has_vat_invoice: true, is_vat_inclusive: true },
];

const CATEGORIES = [
  { label: 'Di chuyển', icon: Truck, color: '#3b82f6' },
  { label: 'Ăn uống', icon: Coffee, color: '#f59e0b' },
  { label: 'Vận hành', icon: Home, color: '#10b981' },
  { label: 'Marketing', icon: Briefcase, color: '#ef4444' },
  { label: 'Công cụ', icon: CreditCard, color: '#BD1D2D' },
  { label: 'Nhân sự', icon: Tag, color: '#06b6d4' },
];

const FMT = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtShort = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'T';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toLocaleString('vi-VN');
};

const EMPTY_FORM = {
  title: '',
  category: 'Khác',
  amount: '',
  vat_amount: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  approver_id: null as number | null,
  related_user_ids: [] as number[],
  vendor_name: '',
  has_vat_invoice: false,
  is_vat_inclusive: false,
  entities: [] as any[],
  image_url: ''
};

export const ExpensesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast, showConfirm } = useUIStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(location.state?.period || 'this_month');
  const [dateRange, setDateRange] = useState<DateRange>(location.state?.dateRange || getDateRange('this_month'));
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  // Unified delete confirmation under showConfirm store state
  const [viewItem, setViewItem] = useState<any>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [catOpen, setCatOpen] = useState(false);
  const [users, setUsers] = useState<any[]>(DEV_MODE ? useMockStore.getState().users : []); // for approver dropdown
  const [contacts, setContacts] = useState<any[]>([]); // for splitting bill
  const [suppliers, setSuppliers] = useState<any[]>([]); // for vendor autocomplete
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const vendorRef = React.useRef<HTMLDivElement>(null);

  const [summary, setSummary] = useState<any>({ total: 0, approved: 0 });

  const fetchExpenses = useCallback(async () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      let list = [...state.expenses];
      
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(e => e.title.toLowerCase().includes(s) || e.notes?.toLowerCase().includes(s));
      }
      
      if (catFilter) list = list.filter(e => e.category === catFilter);
      if (statusFilter) list = list.filter(e => e.status === statusFilter);
      
      setItems(list);
      setTotal(list.length);
      // Mock summary
      setSummary({
        total: list.reduce((acc, e) => acc + Number(e.amount), 0),
        approved: list.filter(e => e.status === 'approved').reduce((acc, e) => acc + Number(e.amount), 0)
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = { 
        page, 
        limit: PAGE_SIZE, 
        from: dateRange.from, 
        to: dateRange.to, 
        status: statusFilter,
        category: catFilter,
        search: search
      };
      const r = await api.get('/expenses', { params });
      const data = r.data.data;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setSummary(data.summary || { total: 0, approved: 0 });
    } catch (e: any) {
      setItems([]);
      setTotal(0);
      addToast('Không thể tải danh sách chi phí', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, dateRange, statusFilter, catFilter, search]);

  // Fetch users & contacts for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vendorRef.current && !vendorRef.current.contains(event.target as Node)) {
        setShowVendorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    api.get('/users').then(r => { const d = r.data.data; setUsers(Array.isArray(d) ? d : (d?.items || [])); }).catch(() => {});
    api.get('/contacts?limit=1000').then(r => setContacts(r.data.data?.items || r.data.data || [])).catch(() => {});
    api.get('/suppliers').then(r => { const d = r.data.data; setSuppliers(Array.isArray(d) ? d : (d?.items || [])); }).catch(() => {});
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // KPIs from server-side summary
  const totalAmt = Number(summary.total || 0);
  const approvedAmt = Number(summary.approved || 0);
  const pendingAmt = Number(summary.pending || 0);
  const prevTotal = Number(summary.prev_total || 0);
  const prevApproved = Number(summary.prev_approved || 0);
  const prevPending = Number(summary.prev_pending || 0);

  const getChangePercent = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const getPeriodCompareText = (p: string) => {
    switch (p) {
      case 'this_month': return 'so với tháng trước';
      case 'last_month': return 'so với tháng trước nữa';
      case 'today': return 'so với hôm qua';
      case 'this_week': return 'so với tuần trước';
      case 'last_30_days': return 'so với 30 ngày trước';
      default: return 'so với kỳ trước';
    }
  };

  const catBreakdown = CATEGORIES.map(c => ({
    ...c,
    total: items.filter(e => e.category === c.label).reduce((s, e) => s + Number(e.amount), 0),
  })).sort((a, b) => b.total - a.total).filter(c => c.total > 0);

  const openCreate = () => { setEditItem(null); setForm(EMPTY_FORM); setVendorSearch(''); setShowModal(true); };
  const openEdit = (item: any) => { 
    setEditItem(item); 
    setVendorSearch(item.vendor_name || '');
    setForm({ 
      title: item.title || '',
      category: item.category || 'Khác',
      amount: String(item.amount || 0),
      date: item.date || new Date().toISOString().split('T')[0],
      approver_id: item.approver_id ? Number(item.approver_id) : null,
      related_user_ids: Array.isArray(item.related_user_ids) 
        ? item.related_user_ids.map(Number) 
        : (typeof item.related_user_ids === 'string' && item.related_user_ids 
            ? item.related_user_ids.split(',').map(Number) 
            : []),
      vendor_name: item.vendor_name || '',
      has_vat_invoice: Boolean(item.has_vat_invoice),
      is_vat_inclusive: Boolean(item.is_vat_inclusive),
      notes: item.notes || '',
      entities: item.entities || [],
      image_url: item.image_url || ''
    });
    setShowModal(true); 
  };

  const handleSave = async () => {
    if (!form.title || !form.amount) { addToast('Điền đầy đủ nội dung và số tiền', 'error'); return; }
    if (form.approver_id === null) { addToast('Vui lòng chọn người duyệt', 'error'); return; }
    setSaving(true);
    try {
      let payloadEntities = form.entities;
      if (form.entities.length > 0) {
        const splitAmt = Number(form.amount) / form.entities.length;
        payloadEntities = form.entities.map((e: any) => ({ ...e, amount: splitAmt }));
      }

      if (editItem) {
        await api.put(`/expenses/${editItem.id}`, { ...form, amount: Number(form.amount), entities: payloadEntities });
        addToast('Đã cập nhật chi phí', 'success');
      } else {
        await api.post('/expenses', { ...form, amount: Number(form.amount), status: 'pending', entities: payloadEntities });
        addToast('Đã nhập chi phí mới – chờ phê duyệt', 'success');
      }
      setShowModal(false);
      fetchExpenses();
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Lỗi khi lưu chi phí', 'error');
    } finally {
      setSaving(false);
    }
  };



  const toggleSelect = (id: number) => setSelected(prev => {
    const ns = new Set(prev);
    if (ns.has(id)) ns.delete(id);
    else ns.add(id);
    return ns;
  });

  const getCatInfo = (label: string) => CATEGORIES.find(c => c.label === label) || { color: '#6b7280', icon: Tag };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Chi phí Vận hành</h1>
          <p className="page-subtitle">Quản lý và theo dõi các khoản chi phí doanh nghiệp</p>
        </div>
        <div className="flex gap-2">
          <PeriodFilter
            value={period}
            onChange={(p, r) => { setPeriod(p); setDateRange(r); setPage(1); }}
          />
          <button className="btn secondary" onClick={() => addToast('Đang xuất bảng kê...', 'info')} title="Xuất dữ liệu">
            <Download size={16} />
            <span className="hide-on-mobile"> Xuất</span>
          </button>
          <button className="btn primary" onClick={openCreate} title="Nhập chi phí">
            <Plus size={16} />
            <span className="hide-on-mobile"> Nhập chi phí</span>
          </button>
        </div>
      </div>

      {/* KPI Cards — styled premium like the data distribution dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          {
            label: 'Tổng chi phí kỳ này',
            value: FMT(totalAmt),
            icon: TrendingDown,
            color: '#ef4444',
            sub: `${summary.total_count || 0} khoản`,
            change: getChangePercent(totalAmt, prevTotal),
            badWhenUp: true
          },
          {
            label: 'Đã phê duyệt',
            value: FMT(approvedAmt),
            icon: CheckCircle2,
            color: '#10b981',
            sub: `${summary.approved_count || 0} khoản đã duyệt`,
            change: getChangePercent(approvedAmt, prevApproved),
            badWhenUp: false
          },
          {
            label: 'Chờ phê duyệt',
            value: FMT(pendingAmt),
            icon: Clock,
            color: '#f59e0b',
            sub: `${summary.pending_count || 0} khoản đang chờ`,
            change: getChangePercent(pendingAmt, prevPending),
            badWhenUp: true
          },
          {
            label: 'Chi phí lớn nhất',
            value: summary.max_amount ? FMT(summary.max_amount) : '—',
            icon: DollarSign,
            color: '#a31422',
            sub: summary.max_title ? summary.max_title.slice(0, 24) + '...' : 'Chưa có dữ liệu',
            change: 0,
            badWhenUp: true
          },
        ].map((k, i) => {
          const isDecrease = k.change < 0;
          const isZero = k.change === 0;
          const trendColor = isZero ? 'var(--color-text-muted)' : ((isDecrease !== k.badWhenUp) ? 'var(--color-success)' : 'var(--color-danger)');
          const TrendIcon = isZero ? null : (isDecrease ? '▼' : '▲');
          
          return (
            <motion.div key={i} className="stat-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div className="stat-kpi__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="stat-kpi__label" style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-light)' }}>{k.label}</div>
                <div className="stat-kpi__icon" style={{ color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <k.icon size={18} />
                </div>
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 32, width: '85%', borderRadius: 6, marginBottom: 8 }} />
              ) : (
                <div className="stat-kpi__value" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: '0.125rem 0', lineHeight: 1.2 }}>{k.value}</div>
              )}
              <div className="stat-kpi__sub" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{k.sub}</div>
              {!isZero && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: trendColor, marginTop: 'auto' }}>
                  <span>{TrendIcon} {isDecrease ? '' : '+'}{k.change}%</span>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>{getPeriodCompareText(period)}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Category breakdown mini-bar */}
      {catBreakdown.length > 0 && (
        <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theo danh mục:</span>
          {catBreakdown.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.label} onClick={() => { setCatFilter(catFilter === c.label ? '' : c.label); setPage(1); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `1.5px solid ${catFilter === c.label ? c.color : 'var(--color-border)'}`, background: catFilter === c.label ? `${c.color}15` : 'transparent', cursor: 'pointer', transition: 'all 0.18s', fontSize: '0.8125rem' }}>
                <Icon size={13} color={c.color} />
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{c.label}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{fmtShort(c.total)}</span>
              </button>
            );
          })}
          {catFilter && <button onClick={() => { setCatFilter(''); setPage(1); }} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}><X size={13} /> Bỏ lọc</button>}
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="filter-search" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ color: 'var(--color-text-muted)' }} />
          <input placeholder="Tìm theo nội dung, người nhập..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          {search && <button onClick={() => setSearch('')}><X size={13} /></button>}
        </div>

        <div style={{ width: 180 }}>
          <CustomSelect 
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'pending', label: 'Chờ duyệt' }
            ]} 
            value={statusFilter} 
            onChange={val => { setStatusFilter(val.toString()); setPage(1); }} 
          />
        </div>

        {selected.size > 0 && (
          <button className="btn danger sm" onClick={() => { setItems(prev => prev.filter((e: any) => !selected.has(e.id))); setSelected(new Set()); addToast(`Đã xóa ${selected.size} khoản`, 'success'); }}>
            <Trash2 size={14} /> Xóa {selected.size} đã chọn
          </button>
        )}
      </div>

      {/* Main table */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 44, padding: '0.875rem 0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                  <CustomCheckbox 
                    checked={items.length > 0 && items.every((e: any) => selected.has(e.id))} 
                    onChange={() => setSelected(items.length > 0 && items.every((e: any) => selected.has(e.id)) ? new Set() : new Set(items.map((e: any) => e.id)))} 
                  />
                </th>
                <th>Khoản chi</th>
                <th>Số tiền & Ngày</th>
                <th>Phê duyệt <Tooltip content="Thành viên phê duyệt (Avatar) và người tạo khoản chi phí này." /></th>
                <th>Trạng thái <Tooltip content="Quy trình duyệt: Chờ duyệt (đang kiểm tra chứng từ), Đã duyệt (chấp thuận thanh toán và ghi nhận chi phí)." /></th>
                <th style={{ textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 20, borderRadius: 4, width: j === 1 ? '80%' : j === 2 ? '60%' : '70%' }} /></td>
                  ))}
                </tr>
              ))}
              <AnimatePresence>
                {!loading && items.map(exp => {
                    const catInfo = getCatInfo(exp.category);
                    const CatIcon = catInfo.icon;
                    const approver = users.find((u: any) => u.id === Number(exp.approver_id));
                  return (
                    <motion.tr 
                      key={exp.id} 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setViewItem(exp)}
                      style={{ cursor: 'pointer' }}
                      className="hover-bg transition-colors"
                    >
                      <td className="col-check" onClick={e => e.stopPropagation()}>
                        <CustomCheckbox checked={selected.has(exp.id)} onChange={() => toggleSelect(exp.id)} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{exp.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: `${catInfo.color}12`, fontSize: '0.75rem', fontWeight: 600, color: catInfo.color }}>
                              <CatIcon size={10} color={catInfo.color} /> {exp.category}
                            </span>
                            {exp.notes && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>• {exp.notes}</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-danger)' }}>{FMT(exp.amount)}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {exp.date && !isNaN(Date.parse(exp.date)) ? new Date(exp.date).toLocaleDateString('vi-VN') : '—'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {approver ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Avatar name={approver.full_name} size={20} />
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{approver.full_name}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa duyệt</span>
                          )}
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tạo bởi: {exp.creator_name}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${exp.status === 'approved' ? 'success' : 'warning'}`}>
                          {exp.status === 'approved' ? <><CheckCircle2 size={11} /> Đã duyệt</> : <><Clock size={11} /> Chờ duyệt</>}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn-icon sm" title="Sửa" onClick={(e) => { e.stopPropagation(); openEdit(exp); }}><Pencil size={13} /></button>
                          <button className="btn-icon sm text-danger" title="Xóa" onClick={(e) => {
                            e.stopPropagation();
                            showConfirm({
                              title: 'Xóa khoản chi phí?',
                              message: `Khoản chi "${exp.title}" sẽ bị xóa vĩnh viễn khỏi hệ thống. Thao tác này không thể hoàn tác.`,
                              confirmText: 'Xóa ngay',
                              cancelText: 'Hủy',
                              isDanger: true,
                              onConfirm: async () => {
                                try {
                                  await api.delete(`/expenses/${exp.id}`);
                                  setItems(prev => prev.filter(item => item.id !== exp.id));
                                  addToast('Đã xóa chi phí', 'success');
                                } catch (error: any) {
                                  addToast(error.response?.data?.message || 'Lỗi khi xóa chi phí', 'error');
                                }
                              }
                            });
                          }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {!loading && total === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                  Không có khoản chi phí nào trong kỳ này
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} pageSize={PAGE_SIZE} onChange={setPage} showSizeChanger onPageSizeChange={() => setPage(1)} />
      </div>

      {/* Add/Edit Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <div className="overlay-backdrop" onClick={() => !saving && setShowModal(false)} style={{ zIndex: 1000 }}>
            <motion.div className="modal-sheet shadow-2xl"
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              
              <div className="modal-header" style={{ padding: '1.5rem 2rem', background: 'linear-gradient(to right, var(--color-bg), var(--color-surface))', borderBottom: '1px solid var(--color-border)', borderTopLeftRadius: 'var(--radius-2xl)', borderTopRightRadius: 'var(--radius-2xl)' }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>{editItem ? 'Cập nhật khoản chi' : 'Nhập chi phí mới'}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: 4 }}>Vui lòng điền thông tin chi tiết và người phê duyệt.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="btn-icon-bare" disabled={saving}><X size={20} /></button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem', maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Nội dung chi *</label>
                  <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="VD: Thuê văn phòng tháng 6..." />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Đơn vị thụ hưởng <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>(Thanh toán cho ai?)</span></label>
                  <div style={{ position: 'relative' }} ref={vendorRef}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 1rem', height: '44px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)' }}>
                      <Building2 size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                      <input
                        style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', color: 'var(--color-text)' }}
                        placeholder="Tìm NCC hoặc nhập tự do..."
                        value={vendorSearch}
                        onChange={e => { setVendorSearch(e.target.value); setForm({ ...form, vendor_name: e.target.value }); setShowVendorDropdown(true); }}
                        onFocus={() => setShowVendorDropdown(true)}
                      />
                      {vendorSearch && <button type="button" onClick={() => { setVendorSearch(''); setForm({ ...form, vendor_name: '' }); }} style={{ color: 'var(--color-text-muted)', display: 'flex' }}><X size={14} /></button>}
                      <ChevronDown size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    </div>

                    {showVendorDropdown && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--color-surface)', borderRadius: '14px', border: '1px solid var(--color-border-light)', boxShadow: '0 16px 32px -8px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' }}>
                        {(Array.isArray(suppliers) ? suppliers : []).filter(s => (s.name || s.company_name || '').toLowerCase().includes(vendorSearch.toLowerCase())).slice(0, 6).map(s => (
                          <div
                            key={s.id}
                            onMouseDown={() => { const n = s.name || s.company_name || ''; setVendorSearch(n); setForm({ ...form, vendor_name: n }); setShowVendorDropdown(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>{(s.name || s.company_name || '?')[0]}</div>
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{s.name || s.company_name}</p>
                              {s.phone && <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{s.phone}</p>}
                            </div>
                          </div>
                        ))}
                        {vendorSearch && !suppliers.find(s => (s.name || s.company_name) === vendorSearch) && (
                          <div
                            onMouseDown={() => { setForm({ ...form, vendor_name: vendorSearch }); setShowVendorDropdown(false); }}
                            style={{ padding: '9px 14px', cursor: 'pointer', borderTop: '1px solid var(--color-border-light)', fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 700 }}
                          >
                            + Dùng "{vendorSearch}" (nhập tự do)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Số tiền (VNĐ) *</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" type="number" min="0" style={{ paddingLeft: '2.5rem', fontWeight: 800, color: 'var(--color-danger)', fontSize: '1.1rem' }} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
                      <Wallet size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    </div>
                    {form.amount && Number(form.amount) > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                        style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, marginTop: '6px', fontStyle: 'italic', paddingLeft: '4px' }}
                      >
                        Bằng chữ: {numberToVietnameseText(form.amount)}
                      </motion.div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Ngày chi</label>
                    <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>

                {/* VAT Settings Panel */}
                <div style={{ background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <CustomCheckbox 
                        checked={form.has_vat_invoice} 
                        onChange={() => setForm({ ...form, has_vat_invoice: !form.has_vat_invoice })} 
                        label="Có hóa đơn VAT"
                      />
                      <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginLeft: '2rem' }}>Chứng từ thuế</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <CustomCheckbox 
                        checked={form.is_vat_inclusive} 
                        onChange={() => setForm({ ...form, is_vat_inclusive: !form.is_vat_inclusive })} 
                        label="Bao gồm VAT"
                      />
                      <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginLeft: '2rem' }}>Giá sau thuế</p>
                    </div>
                  </div>

                  {form.has_vat_invoice && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Thuế %</label>
                        <CustomSelect 
                          options={[
                            { value: '0', label: '0%' },
                            { value: '5', label: '5%' },
                            { value: '8', label: '8%' },
                            { value: '10', label: '10%' }
                          ]} 
                          value={form.amount ? Math.round((Number(form.vat_amount) / Number(form.amount)) * 100).toString() : '10'}
                          onChange={val => {
                            const pct = Number(val);
                            const amt = Math.round(Number(form.amount) * (pct / 100));
                            setForm({ ...form, vat_amount: amt.toString() });
                          }} 
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Tiền thuế VAT (VND)</label>
                        <input 
                          className="form-input" 
                          type="number" 
                          value={form.vat_amount || ''} 
                          onChange={e => setForm({ ...form, vat_amount: e.target.value })} 
                          placeholder="Nhập số tiền thuế..." 
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Danh mục chi phí</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {CATEGORIES.map(c => {
                      const Icon = c.icon;
                      return (
                        <button key={c.label} type="button" onClick={() => setForm({ ...form, category: c.label })}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-full)', border: `2px solid ${form.category === c.label ? c.color : 'var(--color-border)'}`, background: form.category === c.label ? `${c.color}15` : 'transparent', color: form.category === c.label ? c.color : 'var(--color-text-light)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.18s' }}>
                          <Icon size={13} /> {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--color-danger)', fontWeight: 700 }}>Người duyệt *</label>
                    <CustomSelect 
                      options={users.map((u: any) => ({ 
                        value: u.id, 
                        label: u.full_name, 
                        avatar: u.avatar_url,
                        sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                      }))}
                      value={form.approver_id}
                      onChange={val => {
                        const numVal = Number(val);
                        setForm({ 
                          ...form, 
                          approver_id: numVal,
                          related_user_ids: form.related_user_ids.filter((x: number) => x !== numVal)
                        });
                      }}
                      placeholder="Chọn người duyệt..."
                      searchable
                      showAvatars
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Người liên quan</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ maxHeight: '80px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {form.related_user_ids.length === 0 ? <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>Chưa chọn ai</span> : 
                          form.related_user_ids.map((uid: number) => {
                            const u = users.find((x:any) => x.id === uid);
                            return (
                              <span key={uid} style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(163, 20, 34, 0.2)' }}>
                                <Avatar name={u?.full_name} size={16} />
                                {u?.full_name} 
                                <X size={10} style={{cursor:'pointer'}} onClick={() => setForm({...form, related_user_ids: form.related_user_ids.filter((x: number) => x !== uid)})} />
                              </span>
                            );
                          })
                        }
                      </div>
                      <CustomSelect
                        options={users.filter((u:any) => !form.related_user_ids.includes(u.id) && u.id !== form.approver_id).map((u: any) => ({
                          value: String(u.id),
                          label: u.full_name,
                          avatar: u.avatar_url,
                          sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                        }))}
                        value=""
                        onChange={(val) => {
                          const numVal = Number(val);
                          if (numVal && !form.related_user_ids.includes(numVal)) {
                            setForm({ ...form, related_user_ids: [...form.related_user_ids, numVal] });
                          }
                        }}
                        placeholder="+ Thêm người liên quan..."
                        showAvatars
                        searchable
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Ghi chú chi tiết</label>
                    <textarea 
                      className="form-textarea" 
                      rows={3} 
                      value={form.notes} 
                      onChange={e => setForm({ ...form, notes: e.target.value })} 
                      placeholder="Mô tả thêm nếu cần..." 
                      style={{ minHeight: '90px', resize: 'vertical' }} 
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Đính kèm hóa đơn / chứng từ</label>
                    <div style={{
                      flex: 1, border: '2px dashed var(--color-border)', borderRadius: '12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '8px', position: 'relative', cursor: 'pointer', background: 'var(--color-bg)',
                      overflow: 'hidden', minHeight: '90px', transition: 'border-color 0.2s'
                    }}
                      onDragOver={e => e.preventDefault()}
                      onClick={() => document.getElementById('expense-image-upload')?.click()}
                    >
                      {uploadingImg ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="spinner sm"></div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Đang nén & tải lên...</span>
                        </div>
                      ) : form.image_url ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img 
                            src={form.image_url.startsWith('http') ? form.image_url : `${import.meta.env.VITE_API_URL || '/backend'}${form.image_url}`} 
                            alt="Hóa đơn" 
                            style={{ maxWidth: '100%', maxHeight: '72px', objectFit: 'contain', borderRadius: '6px' }} 
                          />
                          <button 
                            type="button"
                            style={{
                              position: 'absolute', top: -4, right: -4, background: 'rgba(239, 68, 68, 0.9)', 
                              color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, 
                              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm({ ...form, image_url: '' });
                            }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-center" style={{ padding: '4px' }}>
                          <Upload size={20} className="text-light" />
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Chọn hoặc kéo thả ảnh</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>WEBP, PNG, JPG (tối đa 5MB)</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        id="expense-image-upload" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingImg(true);
                          try {
                            // 1. Convert & compress to WebP
                            const compressedFile = await compressToWebP(file);
                            // 2. Upload WebP to server
                            const uploadData = new FormData();
                            uploadData.append('file', compressedFile);
                            if (form.image_url) {
                              uploadData.append('previous_url', form.image_url);
                            }
                            const res = await api.post('/upload', uploadData, {
                              headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            if (res.data && res.data.success && res.data.data?.url) {
                              setForm({ ...form, image_url: res.data.data.url });
                              addToast('Tải lên và nén ảnh hóa đơn thành công!', 'success');
                            } else {
                              addToast('Tải ảnh thất bại', 'error');
                            }
                          } catch (err: any) {
                            addToast('Lỗi khi nén & tải ảnh: ' + (err.message || err), 'error');
                          } finally {
                            setUploadingImg(false);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-light)' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Áp dụng cho (Chia đều tiền bill)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {form.entities.length === 0 ? <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Chưa áp dụng cho khách hàng nào</span> : 
                      form.entities.map((e: any) => (
                        <span key={e.entity_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '6px 12px', borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid rgba(163, 20, 34, 0.2)' }}>
                          <Avatar name={e.name} src={e.avatar_url} size={20} />
                          {e.name || `Khách hàng #${e.entity_id}`}
                          <X size={14} style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setForm({ ...form, entities: form.entities.filter((x: any) => x.entity_id !== e.entity_id) })} />
                        </span>
                      ))
                    }
                  </div>
                  <CustomSelect
                    options={contacts.filter(c => !form.entities.find((e: any) => e.entity_id === c.id)).map(c => ({ 
                      value: String(c.id), 
                      label: `${c.first_name} ${c.last_name || ''}`.trim(),
                      avatar: c.avatar_url,
                      sublabel: c.company_name 
                    }))}
                    value=""
                    onChange={(val) => {
                      const found = contacts.find(c => String(c.id) === val);
                      if (found) {
                        setForm({ ...form, entities: [...form.entities, { entity_type: 'contact', entity_id: found.id, name: `${found.first_name} ${found.last_name || ''}`.trim(), avatar_url: found.avatar_url }] });
                      }
                    }}
                    placeholder="+ Thêm khách hàng chia tiền bill..."
                    searchable
                    showAvatars
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '1.5rem 2rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderBottomLeftRadius: 'var(--radius-2xl)', borderBottomRightRadius: 'var(--radius-2xl)' }}>
                <button className="btn secondary" onClick={() => setShowModal(false)} disabled={saving}>Hủy</button>
                <button className="btn primary" onClick={handleSave} disabled={saving} style={{ minWidth: 140 }}>
                  {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                  {saving ? 'Đang lưu...' : (editItem ? 'Cập nhật' : 'Gửi phê duyệt')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    , document.body)}



      {/* Quick View Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {viewItem && (
            <div className="overlay-backdrop" onClick={() => setViewItem(null)} style={{ zIndex: 1000 }}>
            <motion.div className="modal-sheet shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ padding: '2rem' }}
            >
              {/* Close Button & Badge Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <span className={`badge ${viewItem.status === 'approved' ? 'success' : 'warning'}`} style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '8px' }}>
                    {viewItem.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {viewItem.date && !isNaN(Date.parse(viewItem.date)) ? new Date(viewItem.date).toLocaleDateString('vi-VN') : '—'}
                  </span>
                </div>
                <button className="btn-icon-bare" onClick={() => setViewItem(null)} style={{ padding: 4 }}><X size={20} /></button>
              </div>

              {/* Invoice Layout */}
              <div className="card-panel" style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem', borderBottom: '2px dashed var(--color-border-light)', paddingBottom: '1.25rem' }}>
                  <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>Richland Data Automation</h4>
                  <h2 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-text)', margin: 0 }}>HÓA ĐƠN CHI PHÍ</h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', margin: 0 }}>Mã số: #EXP-{viewItem.id}</p>
                </div>

                <div style={{ textAlign: 'center', padding: '1.25rem', background: 'var(--color-bg)', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--color-border-light)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>SỐ TIỀN CHI</span>
                  <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--color-danger)', margin: 0, letterSpacing: '-0.02em' }}>{FMT(viewItem.amount)}</h1>
                  <p style={{ fontSize: '0.775rem', fontWeight: 700, fontStyle: 'italic', color: 'var(--color-primary)', marginTop: '0.5rem', marginBottom: 0 }}>
                    Bằng chữ: {numberToVietnameseText(Number(viewItem.amount))}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Nội dung chi</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{viewItem.title}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Danh mục</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{viewItem.category}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Áp dụng cho</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)', textAlign: 'right', maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                      {(viewItem.entities && viewItem.entities.length > 0) ? (
                        viewItem.entities.map((e: any, idx: number) => {
                          const typeText = e.entity_type === 'contact' ? 'KHTN' : (e.entity_type === 'company' ? 'Công ty' : 'Cơ hội');
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {e.entity_type === 'contact' && (
                                <Avatar src={e.avatar_url} name={e.name} size={18} />
                              )}
                              <span>
                                {e.name || e.entity_id} <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>({typeText}{Number(e.amount) > 0 ? ': ' + FMT(e.amount) : ''})</span>
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        'Không áp dụng'
                      )}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Người tạo</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Avatar src={viewItem.creator_avatar} name={viewItem.creator_name} size={20} />
                      {viewItem.creator_name} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(lúc {viewItem.created_at ? new Date(viewItem.created_at).toLocaleString('vi-VN') : '—'})</span>
                    </span>
                  </div>
                  {viewItem.status === 'approved' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center', borderBottom: viewItem.image_url ? '1px dotted var(--color-border-light)' : 'none', paddingBottom: viewItem.image_url ? '0.5rem' : 0 }}>
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Người duyệt</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Avatar src={viewItem.approver_avatar} name={viewItem.approver_name || 'Admin'} size={20} />
                        <span className="text-success">{viewItem.approver_name || 'Admin'}</span> <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(lúc {viewItem.approved_at ? new Date(viewItem.approved_at).toLocaleString('vi-VN') : '—'})</span>
                      </span>
                    </div>
                  )}
                  {viewItem.image_url && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center', paddingTop: viewItem.status === 'approved' ? '0.5rem' : 0 }}>
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Đính kèm</span>
                      <a 
                        href={viewItem.image_url.startsWith('http') ? viewItem.image_url : `${import.meta.env.VITE_API_URL || '/backend'}${viewItem.image_url}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'underline' }}
                      >
                        <Paperclip size={13} />
                        Xem ảnh hóa đơn
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {viewItem.notes && (
                <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '8px', fontSize: '0.8125rem', color: '#b45309', marginBottom: '1.5rem' }}>
                  <span style={{ fontWeight: 700, display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', letterSpacing: '0.05em' }}>GHI CHÚ / THÔNG TIN THÊM:</span>
                  {viewItem.notes}
                </div>
              )}

              <div className="flex gap-3">
                <button className="btn outline" style={{ flex: 1 }} onClick={() => setViewItem(null)}>Đóng</button>
                {viewItem.status === 'pending' && (
                  <button className="btn success" style={{ flex: 1, background: 'var(--color-success)', color: 'white', border: 'none' }} onClick={async () => {
                    try {
                      await api.patch(`/expenses/${viewItem.id}`, { status: 'approved' });
                      setItems(prev => prev.map(e => e.id === viewItem.id ? {...e, status: 'approved'} : e));
                      addToast('Đã phê duyệt chi phí', 'success');
                      setViewItem(null);
                      fetchExpenses();
                    } catch (e: any) {
                      addToast('Lỗi khi phê duyệt chi phí', 'error');
                    }
                  }}><CheckCircle2 size={14} /> Phê duyệt</button>
                )}
                <button className="btn primary" style={{ flex: 1 }} onClick={() => { const item = viewItem; setViewItem(null); openEdit(item); }}><Pencil size={14} /> Chỉnh sửa</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    , document.body)}
    </div>
  );
};
