import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileText, Plus, Search, Download, CheckCircle2, Clock, AlertCircle,
  Eye, Trash2, Printer, X, Loader2, ArrowUpRight, TrendingUp, DollarSign,
  Pencil, Copy, Send, FileCheck, XCircle, Calendar, RefreshCw, User,
  ChevronDown, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { Pagination } from '../components/ui/Pagination';
import { QuoteEditorModal } from '../components/ui/QuoteEditorModal';
import { CustomModal } from '../components/ui/CustomModal';
import { EmptyCard } from '../components/ui/EmptyCard';
import api from '../api/axios';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { Tooltip } from '../components/ui/Tooltip';
import { useDebounce } from '../hooks/useDebounce';
import { Avatar } from '../components/ui/Avatar';

const PAGE_SIZE = 10;

const FMT = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
const fmtDate = (d: any) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const QuotesPage: React.FC = () => {
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('this_month');
  const [dateRange, setDateRange] = useState<DateRange>(getDateRange('this_month'));
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editorQuote, setEditorQuote] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total_val: 0, accepted_val: 0, sent_count: 0, accepted_count: 0, total_count: 0 });
  const [previewItem, setPreviewItem] = useState<any>(null);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClose);
    return () => document.removeEventListener('mousedown', handleClose);
  }, []);

  const fetchQuotes = useCallback(async () => {
    if (DEV_MODE) {
      setLoading(true);
      const state = getFilteredMockState();
      let list = [...state.quotes];

      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        list = list.filter(q => q.quote_number.toLowerCase().includes(s) || q.title.toLowerCase().includes(s) || q.contact_name?.toLowerCase().includes(s));
      }

      if (statusFilter) {
        list = list.filter(q => q.status === statusFilter);
      }

      setItems(list);
      setTotal(list.length);
      setSummary({
        total_val: list.reduce((sum, q) => sum + q.total, 0),
        accepted_val: list.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.total, 0),
        sent_count: list.filter(q => q.status === 'sent').length,
        accepted_count: list.filter(q => q.status === 'accepted').length,
        total_count: list.length
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        from: dateRange.from,
        to: dateRange.to,
        status: statusFilter,
        search: debouncedSearch
      };
      const r = await api.get('/quotes', { params });
      const data = r.data.data;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setSummary(data.summary || { total_val: 0, accepted_val: 0, sent_count: 0, accepted_count: 0, total_count: 0 });
    } catch (e: any) {
      setItems([]);
      setTotal(0);
      addToast('Lỗi khi tải danh sách báo giá', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, dateRange, statusFilter, debouncedSearch]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  // Client-side items match server-paginated data

  // KPIs
  const totalVal = Number(summary.total_val);
  const acceptedVal = Number(summary.accepted_val);
  const sentCount = Number(summary.sent_count);
  const convRate = Number(summary.total_count) > 0 ? (Number(summary.accepted_count) / Number(summary.total_count)) * 100 : 0;

  const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.ReactNode; color: string }> = {
    draft: { label: 'Nháp', class: 'info', icon: <Pencil size={12} />, color: '#94a3b8' },
    sent: { label: 'Chờ phản hồi', class: 'warning', icon: <Send size={12} />, color: '#f59e0b' },
    accepted: { label: 'Đã duyệt', class: 'success', icon: <FileCheck size={12} />, color: '#10b981' },
    invoiced: { label: 'Đã xuất HĐ', class: 'secondary', icon: <Download size={12} />, color: '#BD1D2D' },
    rejected: { label: 'Từ chối', class: 'danger', icon: <XCircle size={12} />, color: '#ef4444' },
    expired: { label: 'Hết hạn', class: 'secondary', icon: <Clock size={12} />, color: '#64748b' },
  };

  const handleOpenEditor = (quote: any = null) => {
    setEditorQuote(quote);
    setShowEditor(true);
  };

  const handleDelete = (id: number) => {
    showConfirm({
      title: 'Xóa báo giá',
      message: 'Bạn có chắc chắn muốn xóa bản báo giá này?',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/quotes/${id}`);
          setItems(p => p.filter(i => i.id !== id));
          addToast('Đã xóa báo giá', 'success');
        } catch (e: any) {
          addToast('Lỗi khi xóa báo giá', 'error');
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.put(`/quotes/${id}`, { status });
      setItems(p => p.map(i => i.id === id ? { ...i, status } : i));
      addToast(`Đã cập nhật trạng thái báo giá`, 'success');
    } catch (e: any) {
      addToast('Lỗi khi cập nhật trạng thái', 'error');
    }
  };

  const handleConvertToInvoice = async (id: number) => {
    showConfirm({
      title: 'Chuyển thành Hóa đơn',
      message: 'Bạn có chắc chắn muốn chuyển bản báo giá này thành hóa đơn không?',
      onConfirm: async () => {
        try {
          await api.post(`/quotes/${id}/convert`);
          addToast('Đã chuyển thành hóa đơn thành công', 'success');
          fetchQuotes();
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Lỗi khi chuyển đổi', 'error');
        } finally {
          closeConfirm();
        }
      }
    });
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Báo giá</h1>
          <p className="page-subtitle">Tạo và theo dõi các đề xuất kinh doanh với khách hàng</p>
        </div>
        <div className="flex gap-3">
          <PeriodFilter value={period} onChange={(p, r) => { setPeriod(p); setDateRange(r); setPage(1); }} />
          <button className="btn outline" onClick={fetchQuotes} title="Làm mới">
            <RefreshCw size={18} />
            <span className="hide-on-mobile"> Làm mới</span>
          </button>
          <button className="btn primary" onClick={() => handleOpenEditor()} title="Tạo báo giá mới">
            <Plus size={18} />
            <span className="hide-on-mobile"> Tạo báo giá mới</span>
          </button>
        </div>
      </div>

      {/* KPI Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Tổng giá trị đề xuất', value: FMT(totalVal), icon: TrendingUp, color: '#BD1D2D', sub: `${total} bản báo giá` },
          { label: 'Giá trị đã chốt', value: FMT(acceptedVal), icon: FileCheck, color: '#10b981', sub: 'Đã ký hợp đồng' },
          { label: 'Đang chờ phản hồi', value: String(sentCount), icon: Clock, color: '#f59e0b', sub: 'Báo giá chờ phản hồi' },
          { label: 'Tỉ lệ chốt (Win Rate)', value: `${convRate.toFixed(1)}%`, icon: DollarSign, color: '#BD1D2D', sub: 'Hiệu suất bán hàng' },
        ].map((k, i) => (
          <motion.div key={i} className="stat-kpi" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <div className="stat-kpi__header">
              <div className="stat-kpi__label">{k.label}</div>
              <div className="stat-kpi__icon" style={{ color: k.color }}>
                <k.icon size={20} />
              </div>
            </div>
            {loading ? <div className="skeleton" style={{ height: 36, width: '85%', borderRadius: 6, marginBottom: 12 }} />
              : <div className="stat-kpi__value">{k.value}</div>}
            <div className="stat-kpi__sub">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="card-panel mb-4" style={{ padding: '1rem' }}>
        <div className="flex items-center gap-4 flex-wrap" style={{ display: 'flex', width: '100%' }}>
          <div className="filter-search flex-1" style={{ minWidth: '200px' }}>
            <Search size={18} className="text-muted" />
            <input 
              placeholder="Tìm theo mã báo giá, tiêu đề hoặc khách hàng..." 
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Premium Status Dropdown Filter */}
          <div style={{ position: 'relative' }} ref={statusDropdownRef}>
            <button
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="btn secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minWidth: '190px',
                justifyContent: 'space-between',
                padding: '0 1.25rem',
                height: 38,
                fontSize: '0.875rem',
                borderRadius: '10px',
                background: isStatusDropdownOpen ? 'var(--color-bg)' : 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                fontWeight: 600,
                color: 'var(--color-text)'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={15} style={{ color: 'var(--color-text-muted)' }} />
                <span>
                  {statusFilter === '' ? 'Tất cả trạng thái' : STATUS_CONFIG[statusFilter].label}
                </span>
              </span>
              <ChevronDown size={14} style={{ 
                color: 'var(--color-text-muted)',
                transform: isStatusDropdownOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s'
              }} />
            </button>

            <AnimatePresence>
              {isStatusDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    padding: '6px',
                    zIndex: 30,
                    minWidth: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  {['', 'draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => {
                    const label = s === '' ? 'Tất cả trạng thái' : STATUS_CONFIG[s].label;
                    const isActive = statusFilter === s;
                    return (
                      <div
                        key={s}
                        onClick={() => {
                          setStatusFilter(s);
                          setPage(1);
                          setIsStatusDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: isActive ? 700 : 500,
                          background: isActive ? 'rgba(189, 29, 45, 0.08)' : 'transparent',
                          color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => {
                          if (!isActive) e.currentTarget.style.background = 'var(--color-bg)';
                        }}
                        onMouseLeave={e => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span>{label}</span>
                        {isActive && (
                          <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: 'var(--color-primary)'
                          }} />
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
          <table style={{ minWidth: 850 }}>
            <thead>
              <tr>
                <th className="col-check">
                  <CustomCheckbox 
                    checked={selected.size === items.length && items.length > 0} 
                    onChange={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map(i => i.id)))} 
                  />
                </th>
                <th>MÃ BÁO GIÁ</th>
                <th>TIÊU ĐỀ & KHÁCH HÀNG</th>
                <th>TRẠNG THÁI <Tooltip content="Báo giá có các trạng thái: Nháp, Đã gửi, Đã duyệt (có thể chuyển thành hóa đơn), Từ chối hoặc Hết hạn." /></th>
                <th>GIÁ TRỊ</th>
                <th>HẠN HIỆU LỰC <Tooltip content="Báo giá quá hạn hiệu lực sẽ tự động lưu trữ và không thể chuyển đổi thành hóa đơn trực tiếp." /></th>
                <th>NGÀY TẠO</th>
                <th style={{ textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8}><div className="skeleton" style={{ height: 48, borderRadius: 8 }} /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={8} style={{ padding: '2rem 1rem' }}>
                    <EmptyCard
                      icon={<FileText />}
                      title="Không tìm thấy báo giá nào"
                      description="Hệ thống không tìm thấy bản báo giá nào khớp với điều kiện lọc hiện tại. Hãy thử điều chỉnh bộ lọc hoặc tạo một báo giá mới."
                      actionText="Tạo báo giá mới"
                      onAction={() => handleOpenEditor()}
                    />
                  </td>
                </tr>
              ) : (
                items.map(q => (
                  <tr key={q.id} className="table-row-hover" onClick={() => handleOpenEditor(q)}>
                    <td className="col-check" onClick={e => e.stopPropagation()}>
                      <CustomCheckbox checked={selected.has(q.id)} onChange={() => {
                        const ns = new Set(selected);
                        if (ns.has(q.id)) ns.delete(q.id); else ns.add(q.id);
                        setSelected(ns);
                      }} />
                    </td>
                    <td>
                      <span className="font-bold text-primary text-xs font-mono">{q.quote_number}</span>
                    </td>
                    <td>
                      <div className="font-bold text-sm">{q.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        <Avatar name={q.contact_name || 'Khách lẻ'} size="sm" style={{ width: 18, height: 18, fontSize: 8 }} />
                        <span className="text-xs text-light" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {q.contact_name || 'Khách lẻ'} {q.company_name ? `(${q.company_name})` : ''}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CONFIG[q.status]?.class || 'info'}`}>
                        {STATUS_CONFIG[q.status]?.icon} {STATUS_CONFIG[q.status]?.label || q.status}
                      </span>
                    </td>
                    <td>
                      <div className="font-bold text-sm">{FMT(q.total)}</div>
                      <div className="text-[10px] text-muted">{q.items_count || 0} hạng mục</div>
                    </td>
                    <td>
                      <div className={`text-xs flex items-center gap-1 ${new Date(q.valid_until) < new Date() ? 'text-danger font-bold' : ''}`}>
                        <Calendar size={12} /> {fmtDate(q.valid_until)}
                      </div>
                    </td>
                    <td><span className="text-xs text-light">{fmtDate(q.created_at)}</span></td>
                    <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div className="flex gap-3 justify-end">
                        {q.status === 'accepted' && (
                          <button className="btn-icon sm" title="Chuyển thành Hóa đơn" onClick={() => handleConvertToInvoice(q.id)} style={{ color: 'var(--color-success)', background: 'var(--color-success-light)' }}><FileCheck size={14} /></button>
                        )}
                        <button className="btn-icon sm" title="Xem nhanh" onClick={() => setPreviewItem(q)}><Eye size={14} /></button>
                        <button className="btn-icon sm" title="Chỉnh sửa" onClick={() => handleOpenEditor(q)}><Pencil size={14} /></button>
                        <button className="btn-icon sm text-danger" title="Xóa" onClick={() => handleDelete(q.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* Editor Modal */}
      <QuoteEditorModal 
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        quote={editorQuote}
        onSuccess={() => {
          setShowEditor(false);
          fetchQuotes();
        }}
      />

      {/* Preview Modal */}
      <QuoteEditorModal 
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
        quote={previewItem}
        isViewer={true}
        onEdit={() => {
          const itemToEdit = previewItem;
          setPreviewItem(null);
          setTimeout(() => {
            handleOpenEditor(itemToEdit);
          }, 150);
        }}
        onSuccess={() => {
          setPreviewItem(null);
          fetchQuotes();
        }}
      />
    </div>
  );
};
