import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, Plus, Edit, Trash2, LayoutGrid, List, Search, 
  Filter, History, Share, Clock, CheckCircle, AlertTriangle, 
  ChevronDown, DollarSign, CalendarDays, Layers, ArrowRight,
  TrendingDown, TrendingUp, MoreHorizontal, X, Download, FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/uiStore';
import { PurchaseOrdersTab } from '../components/PurchaseOrdersTab';
import api from '../api/axios';
import { useLanguage } from '../contexts/LanguageContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { Avatar } from '../components/ui/Avatar';
import { TableSkeleton, CardSkeleton } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { Pagination } from '../components/ui/Pagination';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import { InventorySyncModal } from '../components/ui/InventorySyncModal';
import { Tooltip } from '../components/ui/Tooltip';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 10;

interface Batch {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  category: string;
  unit: string;
  supplier_name: string;
  batch_code: string;
  import_date: string;
  expiry_date: string | null;
  import_price: number;
  initial_qty: number;
  current_qty: number;
  notes: string | null;
  status: 'active' | 'archived';
}

interface InventoryLog {
  id: number;
  batch_id: number;
  action_type: 'IMPORT' | 'SALE' | 'EXPORT_INTERNAL' | 'ADJUST' | 'RETURN';
  qty_change: number;
  reason: string;
  creator_name: string;
  created_at: string;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const isSale = user?.role === 'sale' || user?.role === 'viewer';
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showInventorySync, setShowInventorySync] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'batches' | 'history' | 'purchase_orders'>('batches');
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [globalLogs, setGlobalLogs] = useState<(InventoryLog & { product_name: string, batch_code: string })[]>([]);
  const [summary, setSummary] = useState({ total_items: 0, out_of_stock: 0, capital_value: 0 });
  
  const [exportForm, setExportForm] = useState({ qty: '', reason: 'Hàng tặng/Quà tặng', receiver_id: '' });
  const [adjustForm, setAdjustForm] = useState({ new_qty: '', reason: 'Điều chỉnh kiểm kho' });
  const [receivers, setReceivers] = useState<{value: string, label: string, sublabel?: string, avatar?: string}[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { showConfirm, addToast, closeConfirm } = useUIStore();


  const fetchReceivers = async () => {
    try {
      const res = await api.get('/contacts?limit=1000');
      const raw = res.data?.data;
      const list = Array.isArray(raw) ? raw : (raw?.items || []);
      setReceivers(list.map((c: any) => ({
        value: String(c.id),
        label: `${c.last_name || ''} ${c.first_name}`.trim(),
        sublabel: c.phone || c.email || '',
        avatar: c.avatar_url
      })));
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchBatches = async () => {
    setLoading(true);
    // Always fetch from API
    try {
      const params: any = { 
        page, 
        limit: PAGE_SIZE, 
        search: debouncedSearch,
        stock_status: statusFilter === 'all' ? '' : statusFilter,
        sort: sortBy.split('_')[0],
        order: sortBy.split('_')[1] === 'desc' ? 'DESC' : 'ASC'
      };
      const res = await api.get('/inventory', { params });
      const data = res.data.data;
      setBatches(data.items || []);
      setTotal(data.total || 0);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchLogs = async (batchId: number) => {
    try {
      const res = await api.get(`/inventory/logs/${batchId}`);
      if (res.data.success) setLogs(res.data.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchGlobalLogs = async () => {
    try {
      const res = await api.get('/inventory/global-logs');
      if (res.data.success) setGlobalLogs(res.data.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [page, debouncedSearch, statusFilter, sortBy]);

  useEffect(() => {
    fetchGlobalLogs();
    fetchReceivers();
  }, []);

  const archiveBatch = (id: number) => {
    showConfirm(
      'Lưu trữ căn hộ/lô đất', 
      'Bạn có chắc chắn muốn lưu trữ căn/lô này? Căn/lô này sẽ không còn xuất hiện trong danh sách hoạt động.',
      async () => {
        try {
          const res = await api.post(`/inventory/archive/${id}`);
          if (res.data.success) {
            addToast('Đã lưu trữ căn hộ/lô đất', 'success');
            fetchBatches();
          }
          closeConfirm();
        } catch (err: any) {
          addToast('Không thể kết nối máy chủ', 'error');
        }
      }
    );
  };

  const handleInternalExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || isSaving) return;
    
    try {
      setIsSaving(true);
      const res = await api.post('/inventory/export', {
        batch_id: selectedBatch.id,
        qty: Number(exportForm.qty),
        reason: exportForm.reason,
        receiver_id: exportForm.receiver_id || null
      });
      if (res.data.success) {
        addToast('Đã xuất kho nội bộ thành công', 'success');
        setShowExportModal(false);
        fetchBatches();
      } else {
        addToast(res.data.message, 'error');
      }
    } catch (err: any) {
      addToast('Không thể kết nối máy chủ', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || isSaving) return;
    
    try {
      setIsSaving(true);
      const res = await api.post('/inventory/adjust', {
        batch_id: selectedBatch.id,
        new_qty: Number(adjustForm.new_qty),
        reason: adjustForm.reason
      });
      if (res.data.success) {
        addToast('Đã điều chỉnh tồn kho thành công', 'success');
        setShowAdjustModal(false);
        fetchBatches();
      } else {
        addToast(res.data.message, 'error');
      }
    } catch (err: any) {
      addToast('Không thể kết nối máy chủ', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredBatches = batches;

  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const toggleDateGroup = (date: string) => {
    setCollapsedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const [now] = useState(() => Date.now());

  const stats = {
    totalValue: summary.capital_value || 0,
    totalBatches: total,
    lowStock: batches.filter(b => b.current_qty > 0 && b.initial_qty > 0 && (b.current_qty / b.initial_qty) <= 0.10).length,
    outOfStock: summary.out_of_stock || 0,
    expiringSoon: batches.filter(b => b.expiry_date && new Date(b.expiry_date) <= new Date(now + 30 * 24 * 60 * 60 * 1000) && b.current_qty > 0).length
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    params.set('type', 'inventory');
    params.set('token', localStorage.getItem('token') || '');
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter && statusFilter !== 'all') params.set('stock_status', statusFilter);
    window.open(`${api.defaults.baseURL}/export?${params.toString()}`, '_blank');
    addToast('Đang tải xuống danh sách căn hộ theo bộ lọc hiện tại...', 'info');
  };

  return (
    <div className="page-container anim-fade-up">
      <div className="page-header" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.25rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
        {/* Row 1: Title & Actions */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Giỏ hàng &amp; Căn hộ</h1>
            <p className="page-subtitle" style={{ margin: '4px 0 0' }}>Quản lý giỏ hàng căn hộ, lô đất dự án và lịch sử giao dịch.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            <button 
              onClick={handleExport} 
              style={{ 
                height: '36px', 
                fontSize: '0.8125rem', 
                padding: '0 12px', 
                gap: '0.4rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s',
                flex: isMobile ? '1 1 calc(50% - 4px)' : 'none'
              }} 
              title="Xuất Excel/CSV"
            >
              <Download size={14} />
              <span>Xuất file</span>
            </button>

            {!isSale && (
              <>
                <button 
                  onClick={() => setShowInventorySync(true)} 
                  style={{ 
                    height: '36px', 
                    fontSize: '0.8125rem', 
                    padding: '0 12px', 
                    gap: '0.4rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    flex: isMobile ? '1 1 calc(50% - 4px)' : 'none'
                  }} 
                  title="Đồng bộ Google Sheets"
                >
                  <FileSpreadsheet size={14} />
                  <span>Đồng bộ Google Sheets</span>
                </button>

                <button 
                  onClick={() => { setActiveTab('purchase_orders'); setShowPOModal(true); }} 
                  style={{ 
                    height: '36px', 
                    fontSize: '0.8125rem', 
                    padding: '0 14px', 
                    gap: '0.4rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    flex: isMobile ? '1 1 100%' : 'none'
                  }} 
                  title="Khai báo căn / lô"
                >
                  <Plus size={14} />
                  <span>Khai báo căn / lô</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Tabs Switcher */}
        <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', overflowX: isMobile ? 'auto' : 'visible', scrollbarWidth: 'none' }} className="hide-scrollbar">
          {/* Pill Tab Switcher */}
          <div style={{ 
            display: 'flex', 
            background: 'var(--color-border-light)', 
            border: '1px solid var(--color-border)',
            padding: '2px', 
            borderRadius: '8px',
            gap: '2px', 
            position: 'relative',
            flexShrink: 0
          }}>
            <button 
              style={{ 
                padding: '6px 14px', 
                borderRadius: '6px', 
                fontSize: '0.8125rem', 
                fontWeight: 700, 
                background: 'transparent', 
                color: activeTab === 'batches' ? 'var(--color-text)' : 'var(--color-text-light)', 
                border: 'none', 
                outline: 'none',
                boxShadow: 'none',
                cursor: 'pointer', 
                whiteSpace: 'nowrap', 
                transition: 'color 0.2s',
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }} 
              onClick={() => setActiveTab('batches')}
            >
              {activeTab === 'batches' && (
                <motion.div 
                  layoutId="activeInventoryTabIndicator"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'var(--color-surface)',
                    borderRadius: '6px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    zIndex: 1
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Package size={14} />
                Danh sách căn / lô
              </span>
            </button>
            <button 
              style={{ 
                padding: '6px 14px', 
                borderRadius: '6px', 
                fontSize: '0.8125rem', 
                fontWeight: 700, 
                background: 'transparent', 
                color: activeTab === 'history' ? 'var(--color-text)' : 'var(--color-text-light)', 
                border: 'none', 
                outline: 'none',
                boxShadow: 'none',
                cursor: 'pointer', 
                whiteSpace: 'nowrap', 
                transition: 'color 0.2s',
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }} 
              onClick={() => setActiveTab('history')}
            >
              {activeTab === 'history' && (
                <motion.div 
                  layoutId="activeInventoryTabIndicator"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'var(--color-surface)',
                    borderRadius: '6px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    zIndex: 1
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <History size={14} />
                Lịch sử giao dịch
              </span>
            </button>
            <button 
              style={{ 
                padding: '6px 14px', 
                borderRadius: '6px', 
                fontSize: '0.8125rem', 
                fontWeight: 700, 
                background: 'transparent', 
                color: activeTab === 'purchase_orders' ? 'var(--color-text)' : 'var(--color-text-light)', 
                border: 'none', 
                outline: 'none',
                boxShadow: 'none',
                cursor: 'pointer', 
                whiteSpace: 'nowrap', 
                transition: 'color 0.2s',
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0
              }} 
              onClick={() => setActiveTab('purchase_orders')}
            >
              {activeTab === 'purchase_orders' && (
                <motion.div 
                  layoutId="activeInventoryTabIndicator"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'var(--color-surface)',
                    borderRadius: '6px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    zIndex: 1
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} />
                Hợp đồng/Bảng hàng
              </span>
            </button>
          </div>
        </div>
      </div>

      <InventorySyncModal 
        isOpen={showInventorySync} 
        onClose={() => setShowInventorySync(false)} 
      />

      {/* Always mounted so header button can open modal from any tab */}
      <div style={{ display: activeTab === 'purchase_orders' ? 'block' : 'none' }}>
        <PurchaseOrdersTab showModal={showPOModal} setShowModal={setShowPOModal} />
      </div>

      {activeTab !== 'purchase_orders' && (
        <>
          {/* Stats Cards — styled premium like the data distribution dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '0.5rem' : '1rem', marginBottom: '1.5rem' }}>
            {[
              { 
                label: 'Tổng số căn / lô', 
                value: String(batches.length), 
                icon: Layers, 
                color: 'var(--color-primary)', 
                bg: 'rgba(189, 29, 45, 0.08)',
                sub: 'căn hộ / lô đất đang quản lý',
                decor: (
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <path d="M50 20 L80 35 L50 50 L20 35 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M20 50 L50 65 L80 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 65 L50 80 L80 65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              { 
                label: 'Căn còn trống (Available)', 
                value: String(batches.filter(b => b.current_qty > 5).length), 
                icon: CheckCircle, 
                color: '#10b981', 
                bg: 'rgba(16, 185, 129, 0.08)',
                sub: 'sẵn sàng giao dịch',
                decor: (
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M35 50 L45 60 L65 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              { 
                label: 'Đã đặt chỗ / cọc (Booking)', 
                value: String(batches.filter(b => b.current_qty > 0 && b.current_qty <= 5).length), 
                icon: Clock, 
                color: '#f59e0b', 
                bg: 'rgba(245, 158, 11, 0.08)',
                sub: 'đang giữ chỗ/cọc tạm',
                decor: (
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M50 20 L50 50 L70 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              },
              { 
                label: 'Đã bán (Sold)', 
                value: String(batches.filter(b => b.current_qty <= 0).length), 
                icon: DollarSign, 
                color: '#ef4444', 
                bg: 'rgba(239, 68, 68, 0.08)',
                sub: 'đã ký hợp đồng mua bán',
                decor: (
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <text x="35" y="68" fill="currentColor" fontSize="50" fontWeight="bold">$</text>
                  </svg>
                )
              },
            ].map((k, i) => {
              const Icon = k.icon;
              return (
                <motion.div 
                  key={i} 
                  className="stat-card hover-lift" 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.06 }}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    minHeight: '135px',
                    padding: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Decorative Background SVG */}
                  <div className="decor-svg" style={{ color: k.color }}>
                    {k.decor}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                    <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{k.label}</span>
                    <div className="stat-icon" style={{
                      background: k.bg,
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: k.color,
                      flexShrink: 0
                    }}>
                      <Icon size={18} />
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
                    {loading ? (
                      <div className="skeleton" style={{ height: 28, width: '80%', borderRadius: 6, marginBottom: 8 }} />
                    ) : (
                      <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '1.5rem', lineHeight: 1.2 }}>{k.value}</div>
                    )}
                    <div className="stat-desc" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'auto', fontWeight: 500 }} title={k.sub}>{k.sub}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center', 
        gap: '0.75rem', 
        background: 'var(--color-surface)', 
        padding: '0.75rem 1rem', 
        borderRadius: 'var(--radius-xl)', 
        border: '1px solid var(--color-border)', 
        marginBottom: '1.5rem', 
        boxShadow: 'var(--shadow-sm)' 
      }}>
        <div className="filter-search" style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)' }} />
          <input 
            placeholder="Tìm theo tên căn, mã căn (Block - Số tầng), dự án..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          flexShrink: 0,
          width: isMobile ? '100%' : 'auto',
          justifyContent: isMobile ? 'space-between' : 'flex-start',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: isMobile ? 1 : 'none', width: isMobile ? 'calc(50% - 4px)' : 180, minWidth: 120 }}>
            <CustomSelect
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'in_stock', label: 'Căn còn trống (Available)' },
                { value: 'low_stock', label: 'Đã đặt chỗ / Cọc (Booking)' },
                { value: 'out_of_stock', label: 'Đã bán (Sold)' }
              ]}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(String(val)); setPage(1); }}
            />
          </div>
          <div style={{ flex: isMobile ? 1 : 'none', width: isMobile ? 'calc(50% - 4px)' : 160, minWidth: 120 }}>
            <CustomSelect
              options={[
                { value: 'date_desc', label: 'Mới nhất trước' },
                { value: 'date_asc', label: 'Cũ nhất trước' },
                { value: 'qty_desc', label: 'Giá trị giảm dần' },
                { value: 'qty_asc', label: 'Giá trị tăng dần' }
              ]}
              value={sortBy}
              onChange={(val) => { setSortBy(String(val)); setPage(1); }}
            />
          </div>
          {!isMobile && <div style={{ width: '1px', height: 24, background: 'var(--color-border)' }} />}
          <div style={{ display: 'flex', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '3px', marginLeft: isMobile ? 'auto' : '0' }}>
            <button title="Danh sách" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent', color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }} onClick={() => setViewMode('list')}><List size={16} /></button>
            <button title="Lưới thẻ" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: viewMode === 'card' ? 'var(--color-surface)' : 'transparent', color: viewMode === 'card' ? 'var(--color-primary)' : 'var(--color-text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }} onClick={() => setViewMode('card')}><LayoutGrid size={16} /></button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        activeTab === 'history' || viewMode === 'list' ? (
          <TableSkeleton rows={6} cols={6} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <CardSkeleton height={200} />
            <CardSkeleton height={200} />
            <CardSkeleton height={200} />
          </div>
        )
      ) : activeTab === 'history' ? (
        <div className="card anim-fade-up" style={{ overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
            <div>
              <h3 className="font-bold m-0" style={{ color: 'var(--color-text)' }}>Lịch sử biến động toàn kho</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Ghi nhận mọi giao dịch nhập, xuất và bán hàng</p>
            </div>
            <span className="badge info">{globalLogs.length} giao dịch</span>
          </div>
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ minWidth: 850 }}>
              <thead>
                <tr>
                  <th>THỜI GIAN</th>
                  <th>SẢN PHẨM / LÔ</th>
                  <th>LOẠI GIAO DỊCH</th>
                  <th style={{ textAlign: 'right' }}>BIẾN ĐỘNG</th>
                  <th>LÝ DO</th>
                  <th>NGƯỜI THỰC HIỆN</th>
                </tr>
              </thead>
              <tbody>
                {globalLogs.map(log => {
                  const isIn = log.qty_change > 0;
                  const typeClass = log.action_type === 'IMPORT' ? 'success'
                                  : log.action_type === 'SALE' ? 'primary'
                                  : log.action_type === 'EXPORT_INTERNAL' ? 'warning'
                                  : 'info';
                  const typeLabel = log.action_type === 'IMPORT' ? 'Nhập kho'
                                  : log.action_type === 'SALE' ? 'Bán hàng'
                                  : log.action_type === 'EXPORT_INTERNAL' ? 'Xuất nội bộ'
                                  : 'Điều chỉnh';
                  return (
                    <tr key={log.id} className="table-row-hover">
                      <td>
                        <div className="font-bold text-sm">{new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-xs text-light" style={{ marginTop: '0.125rem' }}>{new Date(log.created_at).toLocaleDateString('vi-VN')}</div>
                      </td>
                      <td>
                        <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{log.product_name}</div>
                        <div className="text-light" style={{ fontSize: '10px', fontFamily: 'monospace', marginTop: '0.125rem' }}>#{log.batch_code}</div>
                      </td>
                      <td>
                        <span className={`badge ${typeClass}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={`font-bold text-sm`} style={{ color: isIn ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {isIn ? '+' : ''}{log.qty_change}
                        </div>
                      </td>
                      <td><div className="text-sm truncate" style={{ color: 'var(--color-text-muted)', maxWidth: '200px' }} title={log.reason}>{log.reason}</div></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900, flexShrink: 0 }}>
                            {log.creator_name?.charAt(0)}
                          </div>
                          <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{log.creator_name}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', minHeight: '400px', width: '100%' }}>
          <div style={{ flex: 1, background: 'var(--color-surface)', padding: '4rem', borderRadius: 'var(--radius-2xl)', border: '2px dashed var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ width: '96px', height: '96px', background: 'var(--color-bg)', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
              <Package size={48} style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Không tìm thấy lô hàng nào</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: 1.5 }}>
              Thử thay đổi bộ lọc, tìm kiếm bằng từ khóa khác hoặc kiểm tra lại điều kiện.
            </p>
          </div>
        </div>
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className="card" style={{ borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)' }}>
              <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto', overflowX: 'auto' }}>
                <table style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>MÃ CĂN / DỰ ÁN <Tooltip content="Bảng giỏ hàng dự án bất động sản được đồng bộ theo dòng tiền cọc và giỏ hàng của Chủ đầu tư." /></th>
                      <th>NGÀY KHAI BÁO / BÀN GIAO</th>
                      <th style={{ textAlign: 'right' }}>GIÁ BÁN (VND)</th>
                      <th style={{ textAlign: 'center' }}>DIỆN TÍCH (M²)</th>
                      <th>TRẠNG THÁI</th>
                      <th style={{ textAlign: 'right' }}>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBatches.map((b, i) => {
                      const isNewDate = i === 0 || b.import_date !== filteredBatches[i-1].import_date;
                      const dateKey = b.import_date;
                      const isCollapsed = collapsedDates[dateKey];
                      const pct = b.initial_qty > 0 ? Math.min((b.current_qty / b.initial_qty) * 100, 100) : 0;
                      return (
                        <React.Fragment key={b.id}>
                          {isNewDate && (
                            <tr style={{ background: 'var(--color-bg)', cursor: 'pointer' }} onClick={() => toggleDateGroup(dateKey)}>
                              <td colSpan={6} style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--color-border-light)', borderBottom: '1px solid var(--color-border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px', background: 'var(--color-border)', color: 'var(--color-text)', transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                                    <ChevronDown size={14} />
                                  </div>
                                  <CalendarDays size={14} style={{ color: 'var(--color-text-muted)' }} />
                                  Nhập ngày: {new Date(b.import_date).toLocaleDateString('vi-VN')}
                                </div>
                              </td>
                            </tr>
                          )}
                          {!isCollapsed && (
                            <tr className="table-row-hover group">
                              <td>
                                <div className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{b.product_name}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                  {b.category && <span className="badge info text-xs" style={{ padding: '2px 6px', fontSize: '10px' }}>{b.category}</span>}
                                  <span style={{ background: 'var(--color-border-light)', color: 'var(--color-text-light)', padding: '2px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: 800, fontFamily: 'monospace', textTransform: 'uppercase', border: '1px solid var(--color-border)' }}>{b.sku || 'No SKU'}</span>
                                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>#{b.batch_code}</span>
                                </div>
                              </td>
                              <td>
                                <div className="font-bold text-sm">{new Date(b.import_date).toLocaleDateString('vi-VN')}</div>
                                {b.expiry_date && (
                                  <div className="text-xs flex items-center gap-1" style={{ marginTop: '0.25rem', color: 'var(--color-text-muted)' }}>
                                    <Clock size={12} /> Bàn giao: {new Date(b.expiry_date).toLocaleDateString('vi-VN')}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div className="font-bold text-sm">{(b.import_price || 0).toLocaleString()} đ</div>
                                <div className="text-muted" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>{b.unit || 'm²'}</div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                                    {b.current_qty} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-light)' }}>m²</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {b.current_qty <= 0 ? (
                                  <span className="badge danger">Đã bán (Sold)</span>
                                ) : b.current_qty <= 5 ? (
                                  <span className="badge warning">Đặt cọc (Booking)</span>
                                ) : (
                                  <span className="badge success">Còn trống (Available)</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div className="flex gap-2 justify-end group-hover-visible">
                                  <button className="btn-icon sm text-warning" title="Giữ chỗ / Lock căn" onClick={() => { setSelectedBatch(b); setExportForm({ qty: '', reason: 'Lock giữ chỗ', receiver_id: '' }); setShowExportModal(true); }}>
                                    <Share size={14} />
                                  </button>
                                  <button className="btn-icon sm text-primary" title="Lịch sử giao dịch" onClick={() => { setSelectedBatch(b); fetchBatchLogs(b.id); setShowHistoryModal(true); }}>
                                    <History size={14} />
                                  </button>
                                  {!isSale && (
                                    <>
                                      <button className="btn-icon sm text-info" title="Cập nhật thông tin căn" onClick={() => { setSelectedBatch(b); setAdjustForm({ new_qty: String(b.current_qty), reason: 'Cập nhật diện tích/thông số' }); setShowAdjustModal(true); }}>
                                        <Edit size={14} />
                                      </button>
                                      {b.current_qty <= 0 && (
                                        <button className="btn-icon sm text-danger" title="Lưu trữ" onClick={() => archiveBatch(b.id)}>
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                          </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {filteredBatches.map(b => {
                const pct = b.initial_qty > 0 ? Math.min((b.current_qty / b.initial_qty) * 100, 100) : 0;
                return (
                  <motion.div 
                    key={b.id}
                    layout
                    className="card hover-lift"
                    style={{ borderTop: b.current_qty <= 0 ? '4px solid var(--color-danger)' : b.current_qty <= 5 ? '4px solid var(--color-warning)' : '4px solid var(--color-primary)' }}
                  >
                    <div style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                          <h3 style={{ fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '1.125rem' }}>{b.product_name}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                            {b.category && <span className="badge info" style={{ padding: '2px 6px', fontSize: '10px' }}>{b.category}</span>}
                            <span style={{ background: 'var(--color-border-light)', color: 'var(--color-text-light)', padding: '2px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: 800, fontFamily: 'monospace', textTransform: 'uppercase', border: '1px solid var(--color-border)' }}>{b.sku || 'No SKU'}</span>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>#{b.batch_code}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                          <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--color-text)' }}>{(b.import_price || 0).toLocaleString()} đ</div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{b.unit}</div>
                        </div>
                      </div>

                      <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1.5rem', border: '1px solid var(--color-border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tồn kho hiện tại</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 900, color: b.current_qty <= 5 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                            {b.current_qty} <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>/ {b.initial_qty}</span>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'var(--color-border-light)', borderRadius: '100px', overflow: 'hidden' }}>
                          <div 
                            style={{ height: '100%', borderRadius: '100px', transition: 'width 1s ease', width: `${pct}%`, background: pct <= 10 ? 'var(--color-danger)' : pct <= 30 ? 'var(--color-warning)' : 'var(--color-primary)' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)' }}>
                          <CalendarDays size={14} />
                          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Nhập: <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{new Date(b.import_date).toLocaleDateString('vi-VN')}</span></div>
                        </div>
                        {b.expiry_date && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: new Date(b.expiry_date) < new Date() ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                            <Clock size={14} />
                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>HSD: <span style={{ color: new Date(b.expiry_date) < new Date() ? 'var(--color-danger)' : 'var(--color-text)', fontWeight: 700 }}>{new Date(b.expiry_date).toLocaleDateString('vi-VN')}</span></div>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
                        <button 
                          onClick={() => { setSelectedBatch(b); setExportForm({ qty: '', reason: 'Hàng tặng/Quà tặng', receiver_id: '' }); setShowExportModal(true); }}
                          className="btn secondary"
                          style={{ flex: 1, height: '36px', fontSize: '0.75rem', padding: '0' }}
                        >
                          <Share size={14} /> Xuất nội bộ
                        </button>
                        <button 
                          onClick={() => { setSelectedBatch(b); fetchBatchLogs(b.id); setShowHistoryModal(true); }}
                          className="btn secondary"
                          style={{ width: '36px', height: '36px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Lịch sử"
                        >
                          <History size={14} />
                        </button>
                        {!isSale && (
                          <button 
                            onClick={() => { setSelectedBatch(b); setAdjustForm({ new_qty: String(b.current_qty), reason: 'Điều chỉnh kiểm kho' }); setShowAdjustModal(true); }}
                            className="btn secondary"
                            style={{ width: '36px', height: '36px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Điều chỉnh"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end" style={{ marginTop: '2rem' }}>
            <Pagination 
              total={total} 
              page={page} 
              pageSize={PAGE_SIZE} 
              onChange={setPage} 
            />
          </div>
        </>
      )}

      {/* Internal Export Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showExportModal && selectedBatch && (
            <div className="overlay-backdrop" style={{ zIndex: 9999 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="modal-sheet"
              style={{ width: '100%', maxWidth: '480px' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#fef3c715', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fde68a' }}>
                    <Share size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Xuất kho nội bộ</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>#{selectedBatch.batch_code} — {selectedBatch.product_name}</p>
                  </div>
                </div>
                <button className="btn-icon sm" onClick={() => setShowExportModal(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleInternalExport}>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: 'var(--color-warning-light)', padding: '1rem', borderRadius: 'var(--radius-xl)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <AlertTriangle style={{ color: 'var(--color-warning)', marginTop: '2px', flexShrink: 0 }} size={20} />
                    <div style={{ fontSize: '0.75rem', color: '#b45309', lineHeight: 1.5 }}>
                      Bạn đang xuất hàng cho mục đích phi thương mại (Quà tặng, hư hỏng...). Thao tác này sẽ trừ tồn kho và ghi nhận vào chi phí vận hành.
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)' }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Tồn hiện tại</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--color-text)' }}>{selectedBatch.current_qty} {selectedBatch.unit}</div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)' }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Giá vốn lô</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 900, color: 'var(--color-text)' }}>{(selectedBatch.import_price || 0).toLocaleString()} đ</div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Số lượng xuất <span className="text-danger">*</span></label>
                    <input 
                      type="number" 
                      className="form-control" 
                      required 
                      min="1" 
                      max={selectedBatch.current_qty}
                      value={exportForm.qty}
                      onChange={e => setExportForm({...exportForm, qty: e.target.value})}
                      placeholder="Nhập số lượng..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Lý do xuất</label>
                    <CustomSelect 
                      options={[
                        { value: 'Hàng tặng/Quà tặng', label: 'Hàng tặng/Quà tặng' },
                        { value: 'Hư hỏng/Bể vỡ', label: 'Hư hỏng/Bể vỡ' },
                        { value: 'Hao hụt/Mất lạc', label: 'Hao hụt/Mất lạc' },
                        { value: 'Hàng mẫu/Tester', label: 'Hàng mẫu/Tester' },
                        { value: 'Tiêu dùng nội bộ', label: 'Tiêu dùng nội bộ' }
                      ]}
                      value={exportForm.reason}
                      onChange={val => setExportForm({...exportForm, reason: String(val)})}
                    />
                  </div>

                  <AnimatePresence>
                    {exportForm.reason === 'Hàng tặng/Quà tặng' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="form-group" style={{ overflow: 'hidden' }}>
                        <label className="form-label" style={{ color: 'var(--color-primary)' }}>Người nhận (Ghi nhận chi phí CRM)</label>
                        <CustomSelect 
                          options={receivers.map(r => ({ ...r, label: r.label }))}
                          value={exportForm.receiver_id}
                          onChange={val => setExportForm({...exportForm, receiver_id: String(val)})}
                          placeholder="-- Bỏ qua hoặc Chọn khách hàng nhận --"
                          searchable
                          showAvatars
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Chi phí (giá vốn × số lượng) sẽ được tính vào mục chi phí của khách hàng này nếu bạn chọn.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn outline" onClick={() => setShowExportModal(false)} disabled={isSaving}>Hủy bỏ</button>
                  <button type="submit" className="btn primary" style={{ minWidth: '140px' }} disabled={isSaving}>
                    {isSaving ? 'Đang xuất...' : 'Xác nhận xuất'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    , document.body)}

      {/* Adjust Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showAdjustModal && selectedBatch && (
            <div className="overlay-backdrop" style={{ zIndex: 9999 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="modal-sheet"
              style={{ width: '100%', maxWidth: '460px' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Điều chỉnh tồn kho</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Lô #{selectedBatch.batch_code} — {selectedBatch.product_name}</p>
                  </div>
                </div>
                <button className="btn-icon sm" onClick={() => setShowAdjustModal(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleAdjust}>
                <div className="p-6 space-y-4">
                  <div className="form-group">
                    <label className="form-label">Số lượng thực tế mới <span className="text-danger">*</span></label>
                    <input 
                      type="number" 
                      className="form-control" 
                      required 
                      min="0"
                      value={adjustForm.new_qty}
                      onChange={e => setAdjustForm({...adjustForm, new_qty: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ghi chú điều chỉnh</label>
                    <textarea 
                      className="form-control" 
                      rows={3}
                      value={adjustForm.reason}
                      onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})}
                      placeholder="Lý do điều chỉnh (Kiểm kho định kỳ...)"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn outline" onClick={() => setShowAdjustModal(false)} disabled={isSaving}>Hủy bỏ</button>
                  <button type="submit" className="btn primary" style={{ minWidth: '140px' }} disabled={isSaving}>
                    {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    , document.body)}

      {/* History Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showHistoryModal && selectedBatch && (
            <div className="overlay-backdrop" style={{ zIndex: 9999 }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="modal-sheet"
              style={{ width: '100%', maxWidth: '640px' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'var(--color-info-light)', color: 'var(--color-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <History size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Lịch sử lô hàng</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Chi tiết mọi biến động của lô #{selectedBatch.batch_code}</p>
                  </div>
                </div>
                <button className="btn-icon sm" onClick={() => setShowHistoryModal(false)}><X size={18} /></button>
              </div>
              <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                {logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--color-text-muted)' }}>Không có dữ liệu lịch sử</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '19px', width: '2px', background: 'var(--color-border-light)' }}></div>
                    {logs.map((log) => (
                      <div key={log.id} style={{ position: 'relative', paddingLeft: '3rem' }}>
                        <div style={{ position: 'absolute', left: '10px', top: '10px', width: '20px', height: '20px', borderRadius: '50%', border: '4px solid var(--color-surface)', zIndex: 10, background: log.action_type === 'IMPORT' ? 'var(--color-success)' : log.action_type === 'SALE' ? 'var(--color-primary)' : log.action_type === 'EXPORT_INTERNAL' ? 'var(--color-warning)' : 'var(--color-text-muted)' }} />
                        <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{log.reason}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : ''}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>Thay đổi:</span>
                              <span style={{ fontWeight: 900, color: log.qty_change > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                {log.qty_change > 0 ? '+' : ''}{log.qty_change} {selectedBatch.unit}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: 'var(--color-text-muted)' }}>Thực hiện:</span>
                              <span style={{ fontWeight: 700, color: 'var(--color-text-light)' }}>{log.creator_name}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                <button onClick={() => setShowHistoryModal(false)} className="btn primary" style={{ minWidth: '120px' }}>Đóng</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    , document.body)}
        </>
      )}
    </div>
  );
}
