import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Plus, Search, Download, Truck, Coffee, Home,
  Briefcase, CreditCard, Tag, Eye, Pencil, Trash2, Loader2,
  CheckCircle2, Clock, TrendingDown, X, ArrowUpRight, ArrowDownRight, ChevronDown, Building2, Wallet, User
} from 'lucide-react';
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

const PAGE_SIZE = 50;

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
  { label: 'Công cụ', icon: CreditCard, color: '#8b5cf6' },
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
  entities: [] as any[]
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

  const [summary, setSummary] = useState({ total: 0, approved: 0 });

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
    api.get('/contacts').then(r => setContacts(r.data.data?.items || r.data.data || [])).catch(() => {});
    api.get('/suppliers').then(r => { const d = r.data.data; setSuppliers(Array.isArray(d) ? d : (d?.items || [])); }).catch(() => {});
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // KPIs from server-side summary
  const totalAmt = Number(summary.total);
  const approvedAmt = Number(summary.approved);
  const pendingAmt = totalAmt - approvedAmt;
  const maxItem = items.reduce((mx, e) => Number(e.amount) > Number(mx?.amount || 0) ? e : mx, null as any);
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
      entities: item.entities || []
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

      {/* KPI Cards — NO borders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          {
            label: 'Tổng chi phí kỳ này', value: FMT(totalAmt), icon: TrendingDown,
            color: '#ef4444', sub: `${items.length} khoản`,
          },
          {
            label: 'Đã phê duyệt', value: FMT(approvedAmt), icon: CheckCircle2,
            color: '#10b981',
            sub: `${items.filter(e => e.status === 'approved').length} khoản đã duyệt`,
          },
          {
            label: 'Chờ phê duyệt', value: FMT(pendingAmt), icon: Clock,
            color: '#f59e0b',
            sub: `${items.filter(e => e.status === 'pending').length} khoản đang chờ`,
          },
          {
            label: 'Chi phí lớn nhất', value: maxItem ? FMT(maxItem.amount) : '—', icon: DollarSign,
            color: '#a31422',
            sub: maxItem?.title ? maxItem.title.slice(0, 24) + '...' : 'Chưa có dữ liệu',
          },
        ].map((k, i) => (
          <motion.div key={i} className="stat-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <div className="stat-kpi__header">
              <div className="stat-kpi__icon" style={{ background: `${k.color}12`, color: k.color }}>
                <k.icon size={16} />
              </div>
              <div className="stat-kpi__label">{k.label}</div>
            </div>
            {loading ? <div className="skeleton" style={{ height: 38, width: '85%', borderRadius: 6, marginBottom: 12 }} />
              : <div className="stat-kpi__value">{k.value}</div>}
            <div className="stat-kpi__sub">{k.sub}</div>
          </motion.div>
        ))}
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
        <div className="table-wrap">
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
                      onChange={val => setForm({ ...form, approver_id: Number(val) })}
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
                              <span key={uid} style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
                                <Avatar name={u?.full_name} size={16} />
                                {u?.full_name} 
                                <X size={10} style={{cursor:'pointer'}} onClick={() => setForm({...form, related_user_ids: form.related_user_ids.filter((x: number) => x !== uid)})} />
                              </span>
                            );
                          })
                        }
                      </div>
                      <CustomSelect
                        options={users.filter((u:any) => !form.related_user_ids.includes(u.id)).map((u: any) => ({
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

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Ghi chú chi tiết</label>
                  <textarea className="form-textarea" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Mô tả thêm nếu cần..." style={{ minHeight: '80px' }} />
                </div>

                <div className="form-group" style={{ background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-light)' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Áp dụng cho (Chia đều tiền bill)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {form.entities.length === 0 ? <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Chưa áp dụng cho khách hàng nào</span> : 
                      form.entities.map((e: any) => (
                        <span key={e.entity_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '6px 12px', borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid rgba(124, 58, 237, 0.2)' }}>
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



      {/* Quick View Modal */}
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
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge ${viewItem.status === 'approved' ? 'success' : 'warning'}`}>
                      {viewItem.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{viewItem.date && !isNaN(Date.parse(viewItem.date)) ? new Date(viewItem.date).toLocaleDateString('vi-VN') : '—'}</span>
                  </div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-text)' }}>{viewItem.title}</h3>
                </div>
                <button className="btn-icon-bare" onClick={() => setViewItem(null)}><X size={20} /></button>
              </div>

              <div className="card-panel p-4 mb-6" style={{ background: 'var(--color-bg)' }}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-border-light">
                   <span className="text-light font-bold text-sm">Số tiền</span>
                   <span className="text-danger font-bold text-xl">{FMT(viewItem.amount)}</span>
                </div>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-border-light">
                  <span className="text-light font-bold text-sm">Danh mục</span>
                  <span className="font-bold">{viewItem.category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-light font-bold text-sm">Người nhập</span>
                  <span className="font-bold">{viewItem.creator_name}</span>
                </div>
              </div>

              {viewItem.notes && (
                <div className="mb-6">
                   <span className="text-xs font-semibold uppercase text-light tracking-widest mb-2 block">Ghi chú</span>
                   <p className="text-sm text-text-light bg-surface border border-border p-3 rounded-xl">{viewItem.notes}</p>
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
    </div>
  );
};
