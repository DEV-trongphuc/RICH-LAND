import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  FileText, Plus, Search, Download, CheckCircle2, Clock, AlertCircle,
  Eye, Trash2, Printer, X, Loader2, ArrowUpRight, TrendingUp, DollarSign,
  Pencil, Copy, Send, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { Pagination } from '../components/ui/Pagination';
import api from '../api/axios';
import { EmptyCard } from '../components/ui/EmptyCard';
import { Tooltip } from '../components/ui/Tooltip';
import { useDebounce } from '../hooks/useDebounce';
import { Avatar } from '../components/ui/Avatar';

const PAGE_SIZE = 10;

const FMT = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtDate = (d: any) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const InvoicesPage: React.FC = () => {
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('this_month');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('this_month'));
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>({ total_rev: 0, paid_amt: 0, pending_amt: 0, overdue_amt: 0 });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { 
        page, 
        limit: PAGE_SIZE, 
        from: dateRange.from, 
        to: dateRange.to, 
        status: statusFilter,
        search: search
      };
      const r = await api.get('/invoices', { params });
      const data = r.data.data;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setSummary(data.summary || { total_rev: 0, paid_amt: 0, pending_amt: 0, overdue_amt: 0 });
    } catch (e: any) {
      setItems([]);
      setTotal(0);
      addToast('Không thể kết nối với máy chủ Backend', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, dateRange, statusFilter, search]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    if (location.state?.openCreate) {
      const contact = location.state.defaultContact;
      useUIStore.getState().setShowPOS(contact || true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate]);

  // ESC key to close modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewItem) setPreviewItem(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [previewItem]);

  // Client-side items match server-paginated data

  const userRole = useAuthStore.getState().user?.role;
  const canEditInvoice = userRole === 'admin' || userRole === 'superadmin' || userRole === 'super_admin' || userRole === 'manager' || userRole === 'director' || userRole === 'sale' || userRole === 'sales';

  // KPIs from server summary
  const totalRev = Number(summary.total_rev || 0);
  const paidAmt = Number(summary.paid_amt || 0);
  const pendingAmt = Number(summary.pending_amt || 0);
  const overdueAmt = Number(summary.overdue_amt || 0);
  const prevTotalRev = Number(summary.prev_total_rev || 0);
  const prevPaidAmt = Number(summary.prev_paid_amt || 0);
  const prevPendingAmt = Number(summary.prev_pending_amt || 0);
  const prevOverdueAmt = Number(summary.prev_overdue_amt || 0);

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

  const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
    paid: { label: 'Đã thanh toán', class: 'success', icon: <CheckCircle2 size={11} /> },
    pending: { label: 'Chờ thanh toán', class: 'warning', icon: <Clock size={11} /> },
    overdue: { label: 'Quá hạn', class: 'danger', icon: <AlertCircle size={11} /> },
  };

  const toggleSelect = (id: number) => setSelected(prev => {
    const ns = new Set(prev);
    if (ns.has(id)) ns.delete(id);
    else ns.add(id);
    return ns;
  });
  const allSelected = items.length > 0 && items.every(i => selected.has(i.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)));



  const handleMarkPaid = (inv: any) => {
    showConfirm({
      title: 'Xác nhận thanh toán',
      message: `Đánh dấu hóa đơn ${inv.invoice_number} đã được thanh toán đầy đủ?`,
      confirmText: 'Xác nhận',
      onConfirm: async () => {
        try {
          await api.post(`/invoices/${inv.id}/pay`);
          setItems(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid' } : i));
          addToast(`Đã cập nhật ${inv.invoice_number} thành Đã thanh toán`, 'success');
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Không thể cập nhật trạng thái', 'error');
        }
        closeConfirm();
      }
    });
  };

  const handleSendReminder = (inv: any) => {
    showConfirm({
      title: 'Gửi thông báo',
      message: `Hệ thống sẽ gửi email/Zalo nhắc nhở hóa đơn đến ${inv.contact_name}. Bạn có chắc chắn?`,
      confirmText: 'Gửi ngay',
      onConfirm: () => {
        addToast(`Đã gửi nhắc nhở đến ${inv.contact_name}`, 'success');
        closeConfirm();
      }
    });
  };

  const exportCSV = () => {
    const headers = ['Mã HĐ', 'Khách hàng', 'Công ty', 'Nội dung', 'Tổng tiền', 'Ngày lập', 'Đến hạn', 'Trạng thái'];
    const rows = items.map(i => [
      i.invoice_number, i.contact_name, i.company_name, i.title, i.total, i.issue_date || i.created_at, i.due_date, i.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `danh_sach_hoa_don_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    addToast('Đã xuất file CSV thành công', 'success');
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Hóa đơn & Thu tiền</h1>
          <p className="page-subtitle">Quản lý giao dịch tài chính và trạng thái thanh toán</p>
        </div>
        <div className="flex gap-2">
          <PeriodFilter value={period} onChange={(p, r) => { setPeriod(p); setDateRange(r); setPage(1); }} />
          <button className="btn secondary" onClick={exportCSV} title="Xuất CSV">
            <Download size={16} />
            <span className="hide-on-mobile"> Xuất CSV</span>
          </button>
          {canEditInvoice && (
            <button className="btn primary" onClick={() => useUIStore.getState().setShowPOS(true)} title="Tạo hóa đơn">
              <Plus size={16} />
              <span className="hide-on-mobile"> Tạo hóa đơn</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          {
            label: 'Tổng doanh thu',
            value: FMT(totalRev),
            icon: TrendingUp,
            color: '#a31422',
            sub: `${items.length} hóa đơn`,
            change: getChangePercent(totalRev, prevTotalRev),
            badWhenUp: false
          },
          {
            label: 'Đã thu hồi',
            value: FMT(paidAmt),
            icon: CheckCircle2,
            color: '#10b981',
            sub: `${items.filter(i => i.status === 'paid').length} đã thanh toán`,
            change: getChangePercent(paidAmt, prevPaidAmt),
            badWhenUp: false
          },
          {
            label: 'Chờ thanh toán',
            value: FMT(pendingAmt),
            icon: Clock,
            color: '#f59e0b',
            sub: `${items.filter(i => i.status === 'pending').length} hóa đơn đang đợi`,
            change: getChangePercent(pendingAmt, prevPendingAmt),
            badWhenUp: true
          },
          {
            label: 'Nợ quá hạn',
            value: FMT(overdueAmt),
            icon: AlertCircle,
            color: '#ef4444',
            sub: `${items.filter(i => i.status === 'overdue').length} hóa đơn quá hạn`,
            change: getChangePercent(overdueAmt, prevOverdueAmt),
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
                <div className="stat-kpi__icon" style={{ color: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><k.icon size={18} /></div>
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 32, width: '85%', borderRadius: 6, marginBottom: 8 }} />
              ) : (
                <div className="stat-kpi__value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: '0.125rem 0', lineHeight: 1.2 }}>{k.value}</div>
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

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { key: '', label: 'Tất cả', count: items.length },
          { key: 'paid', label: 'Đã thanh toán', count: items.filter(i => i.status === 'paid').length },
          { key: 'pending', label: 'Chờ thanh toán', count: items.filter(i => i.status === 'pending').length },
          { key: 'overdue', label: 'Quá hạn', count: items.filter(i => i.status === 'overdue').length },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.18s', border: '1px solid', borderColor: statusFilter === tab.key ? 'var(--color-primary)' : 'var(--color-border-light)', background: statusFilter === tab.key ? 'var(--color-primary-light)' : 'var(--color-surface)', color: statusFilter === tab.key ? 'var(--color-primary)' : 'var(--color-text-light)' }}>
            {tab.label} <span style={{ marginLeft: '4px', opacity: 0.75 }}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div className="filter-search" style={{ flex: 1 }}>
          <Search size={15} style={{ color: 'var(--color-text-muted)' }} />
          <input placeholder="Tìm mã hóa đơn, khách hàng, công ty..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          {search && <button onClick={() => setSearch('')}><X size={13} /></button>}
        </div>
        {selected.size > 0 && (
          <div className="flex gap-2">
            <button className="btn outline sm"><Printer size={13} /> In {selected.size} HĐ</button>
            <button className="btn danger sm" onClick={() => { setItems(p => p.filter(i => !selected.has(i.id))); setSelected(new Set()); addToast(`Đã xóa ${selected.size} hóa đơn`, 'success'); }}>
              <Trash2 size={13} /> Xóa {selected.size}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="table-wrap responsive-table-wrap mobile-card-table" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th className="col-check"><CustomCheckbox checked={allSelected} onChange={toggleAll} /></th>
                <th>Hóa đơn <Tooltip content="Mã định danh duy nhất của hóa đơn tài chính & nội dung diễn giải." /></th>
                <th>Khách hàng</th>
                <th>Số tiền</th>
                <th>Thời hạn <Tooltip content="Ngày lập hóa đơn và hạn thanh toán cuối cùng." /></th>
                <th>Trạng thái <Tooltip content="Trạng thái giao dịch: Đã thanh toán, Chờ thanh toán, hoặc Quá hạn." /></th>
                <th style={{ textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((__, j) => <td key={j}><div className="skeleton" style={{ height: 20, borderRadius: 4 }} /></td>)}</tr>
              ))}
              <AnimatePresence>
                {!loading && items.map(inv => {
                  const sc = STATUS_CONFIG[inv.status] || { label: inv.status, class: 'info', icon: null };
                  const isOverdue = inv.status === 'overdue';
                  return (
                    <motion.tr key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ background: isOverdue ? 'rgba(239,68,68,0.02)' : undefined, cursor: 'pointer' }} className="table-row-hover" onClick={() => setPreviewItem(inv)}>
                      <td data-label="Chọn" className="col-check" onClick={e => e.stopPropagation()}>
                        <CustomCheckbox checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)} />
                      </td>
                      <td data-label="Hóa đơn">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.8125rem', fontFamily: 'monospace' }}>{inv.invoice_number}</span>
                            {inv.is_inventory_deducted === 1 && (
                              <Tooltip content="Hóa đơn này đã được tự động khấu trừ số lượng sản phẩm tương ứng trong kho hàng.">
                                <Package size={12} style={{ color: 'var(--color-success)', cursor: 'help' }} />
                              </Tooltip>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }} title={inv.title}>
                            {inv.title}
                          </div>
                        </div>
                      </td>
                      <td data-label="Khách hàng">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar name={inv.contact_name || 'Khách lẻ'} size="sm" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }} title={inv.contact_name || 'Khách lẻ'}>{inv.contact_name || 'Khách lẻ'}</div>
                            {inv.company_name && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }} title={inv.company_name}>
                                {inv.company_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Số tiền"><span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{FMT(inv.total)}</span></td>
                      <td data-label="Thời hạn">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Lập: {fmtDate(inv.issue_date || inv.created_at)}</span>
                          <span style={{ fontSize: '0.75rem', color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: isOverdue ? 700 : 500 }}>
                            Hạn: {fmtDate(inv.due_date)}
                          </span>
                        </div>
                      </td>
                      <td data-label="Trạng thái"><span className={`badge ${sc.class}`}>{sc.icon} {sc.label}</span></td>
                      <td data-label="Thao tác" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn-icon sm" title="Xem nhanh" onClick={() => setPreviewItem(inv)}><Eye size={14} /></button>
                          {canEditInvoice && inv.status !== 'paid' && (
                            <button className="btn-icon sm" title="Đánh dấu đã thanh toán" onClick={() => handleMarkPaid(inv)} style={{ color: 'var(--color-success)' }}><CheckCircle2 size={14} /></button>
                          )}
                          {canEditInvoice && (
                            <button className="btn-icon sm text-danger" title="Xóa" onClick={() => {
                              showConfirm({
                                title: `Xóa hóa đơn ${inv.invoice_number}?`,
                                message: `Hóa đơn này sẽ bị xóa vĩnh viễn khỏi hệ thống. Thao tác này không thể hoàn tác.`,
                                confirmText: 'Xóa ngay',
                                cancelText: 'Hủy',
                                isDanger: true,
                                onConfirm: async () => {
                                  try {
                                    await api.delete(`/invoices/${inv.id}`);
                                    setItems(prev => prev.filter(i => i.id !== inv.id));
                                    addToast('Đã xóa hóa đơn', 'success');
                                  } catch (e: any) {
                                    addToast(e.response?.data?.message || 'Không thể xóa hóa đơn', 'error');
                                  }
                                }
                              });
                            }}><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {!loading && items.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={7} style={{ padding: '2rem 1rem' }}>
                    <EmptyCard
                      icon={<FileText />}
                      title="Không tìm thấy Hóa đơn nào"
                      description="Hệ thống không tìm thấy bất kỳ hóa đơn nào khớp với bộ lọc hoặc khoảng thời gian hiện tại."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} pageSize={PAGE_SIZE} onChange={setPage} showSizeChanger onPageSizeChange={() => setPage(1)} />
      </div>



      {/* Preview Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {previewItem && (
            <motion.div 
            className="overlay-backdrop" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setPreviewItem(null)} 
            style={{ zIndex: 1000 }}
          >
            <style>{`
              @media print {
                body {
                  background: var(--color-surface) !important;
                  color: black !important;
                }
                #root {
                  display: none !important;
                }
                .overlay-backdrop {
                  position: static !important;
                  background: transparent !important;
                  display: block !important;
                  padding: 0 !important;
                  height: auto !important;
                  width: auto !important;
                  opacity: 1 !important;
                  overflow: visible !important;
                }
                .invoice-print-container {
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                  border-radius: 0 !important;
                  background: var(--color-surface) !important;
                  position: static !important;
                  transform: none !important;
                  overflow: visible !important;
                }
                .invoice-paper-content {
                  padding: 0 !important;
                  background: var(--color-surface) !important;
                }
                .invoice-info-box {
                  border: none !important;
                  background: transparent !important;
                  padding: 0 !important;
                  border-radius: 0 !important;
                }
                .no-print {
                  display: none !important;
                }
                .print-no-avatar {
                  display: none !important;
                }
                table, thead, tbody, tfoot, tr, th, td {
                  border: none !important;
                  border-top: none !important;
                  border-bottom: none !important;
                }
              }
            `}</style>
            <motion.div
              className="modal-sheet invoice-print-container"
              style={{ width: '90%', maxWidth: 700, zIndex: 1010, padding: 0, borderRadius: 'var(--radius-2xl)', margin: 'auto', overflow: 'hidden' }}
              initial={{ opacity: 0, scale: 0.96, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="invoice-paper-content" style={{ padding: '2rem', background: 'var(--color-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>INVOICE</h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Mã số: {previewItem.invoice_number}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h3 style={{ fontWeight: 700 }}>{useAuthStore.getState().user?.tenant_name || 'CRM System'}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Hà Nội, Việt Nam</p>
                  </div>
                </div>

                <div className="responsive-grid-1-1 invoice-info-box" style={{ gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-light)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p className="text-xs text-light uppercase tracking-wider font-bold" style={{ margin: 0 }}>Khách hàng nhận</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                      <div 
                        className="print-no-avatar"
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--color-primary), #ef4444)',
                          color: 'white',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          boxShadow: '0 4px 10px rgba(189, 29, 45, 0.15)',
                          flexShrink: 0
                        }}
                      >
                        {previewItem.contact_name ? previewItem.contact_name.trim().split(' ').pop().charAt(0).toUpperCase() : 'K'}
                      </div>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: 'var(--color-text)' }}>{previewItem.contact_name || 'Khách lẻ'}</p>
                        {previewItem.contact_phone && (
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '3px 0 0 0', fontWeight: 600 }}>
                            SĐT: {previewItem.contact_phone}
                          </p>
                        )}
                        {previewItem.company_name && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0', fontWeight: 500 }}>
                            {previewItem.company_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p className="text-xs text-light uppercase tracking-wider font-bold" style={{ marginBottom: '4px' }}>Thông tin thanh toán</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <p className="text-sm" style={{ margin: 0 }}>Ngày lập: <strong style={{ color: 'var(--color-text)' }}>{fmtDate(previewItem.issue_date || previewItem.created_at)}</strong></p>
                      <p className="text-sm" style={{ margin: 0 }}>Hạn thanh toán: <strong style={{ color: 'var(--color-text)' }}>{fmtDate(previewItem.due_date)}</strong></p>
                      <div style={{ marginTop: '6px' }}>
                        {previewItem.status === 'paid' ? (
                          <span className="badge success" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800 }}>Đã thanh toán</span>
                        ) : previewItem.status === 'overdue' ? (
                          <span className="badge danger" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800 }}>Quá hạn</span>
                        ) : (
                          <span className="badge warning" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800 }}>Chờ thanh toán</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 0' }}>MÔ TẢ DỊCH VỤ</th>
                      <th style={{ textAlign: 'right', padding: '12px 0' }}>SỐ TIỀN</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '16px 0' }}>
                        <p style={{ fontWeight: 600 }}>{previewItem.title}</p>
                        <p className="text-xs text-light">Dịch vụ cung cấp trọn gói theo hợp đồng</p>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{FMT(previewItem.total)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--color-border)' }}>
                       <td style={{ padding: '8px 0', fontSize: '0.875rem' }}>Phí vận chuyển ({previewItem.shipping_customer_pay ? 'Khách trả' : 'Shop trả'})</td>
                       <td style={{ textAlign: 'right', fontWeight: 600 }}>{FMT(previewItem.shipping_fee || 0)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '16px 0', fontWeight: 700, fontSize: '1.1rem' }}>TỔNG CỘNG</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-primary)' }}>{FMT(previewItem.total)}</td>
                    </tr>
                  </tfoot>
                </table>

                <div className="no-print" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
                  <button className="btn ghost" onClick={() => setPreviewItem(null)}>Đóng</button>
                  <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> In Hóa Đơn</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    , document.body)}
    </div>
  );
};
