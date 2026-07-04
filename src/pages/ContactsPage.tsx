import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Phone, Mail, Eye, Trash2, X, Download, Users, Tag as TagIcon, UserCheck, RefreshCw, Filter, LayoutGrid, List, ArrowDownUp, Columns, Building2, Briefcase, Loader2, User, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { useUIStore } from '../store/uiStore';
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import { LeadScoreRing } from '../components/ui/LeadScoreRing';
import { TagDisplay } from '../components/ui/TagInput';
import { Pagination } from '../components/ui/Pagination';
import { ColumnCustomizer, type ColumnDef } from '../components/ui/ColumnCustomizer';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { Skeleton, TableSkeleton } from '../components/ui/Skeleton';
import { PhoneLink } from '../components/ui/PhoneLink';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { AddressSelect } from '../components/ui/AddressSelect';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import api from '../api/axios';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 10;

const STATUS_LABEL: Record<string,string> = { lead:'Lead mới', qualified:'Đủ điều kiện', customer:'Khách hàng', churned:'Đã rời' };
const STATUS_CLASS: Record<string,string> = { lead:'info', qualified:'warning', customer:'success', churned:'danger' };

const calcScore = (c: any) => {
  if (!c) return 0;
  let s = 50;
  if (c.status==='customer')  s+=30;
  if (c.status==='qualified') s+=15;
  if (c.status==='churned')   s-=20;
  if (c.source==='referral')  s+=10;
  if (c.has_called)           s+=15;
  return Math.min(100, Math.max(0,s));
};

const SEGMENTS = [];

const SOURCE_OPTIONS = [
  { value: '', label: 'Tất cả nguồn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google Ads' },
  { value: 'referral', label: 'Giới thiệu' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Khác' }
];

const FMT_VND = (n: any) => {
  const num = Math.round(Number(n || 0));
  if (!num) return '—';
  if (num >= 1e9) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num / 1e9) + ' Tỷ đ';
  }
  if (num >= 1e6) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(num / 1e6) + ' Tr đ';
  }
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};
const AGO_DAYS = (d: string) => d ? Math.floor((Date.now()-new Date(d).getTime())/86400000) : 999;

export const ContactsPage: React.FC = () => {
  const { user } = useAuth();
  const isSale = user?.role === 'sale';
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300); // 300ms debounce
  const [segment, setSegment] = useState('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [profileContact, setProfileContact] = useState<any>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company_name: '', job_title: '', status: 'lead', source: 'other', owner_id: '', city: '', ward: '', address: '' });
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // Advanced Filter state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwnerId, setFilterOwnerId] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [dateFilterType, setDateFilterType] = useState<'range' | 'before' | 'after'>('range');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterBeforeDate, setFilterBeforeDate] = useState('');
  const [filterAfterDate, setFilterAfterDate] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [activeFilters, setActiveFilters] = useState({
    status: '',
    source: '',
    ownerId: '',
    projectId: '',
    tag: '',
    dateField: 'created_at' as 'created_at' | 'updated_at' | 'last_contact',
    dateType: 'range' as 'range' | 'before' | 'after',
    fromDate: '',
    toDate: '',
    beforeDate: '',
    afterDate: '',
    dateActive: false
  });

  useEffect(() => {
    if (showCreateModal && user) {
      setCreateForm(prev => ({
        ...prev,
        owner_id: isSale ? String(user.id || '') : ''
      }));
    }
  }, [showCreateModal, user, isSale]);

  // New Enterprise Features State
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => window.innerWidth <= 768 ? 'card' : 'list');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600);
      if (window.innerWidth <= 768) {
        setViewMode('card');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const [sortBy, setSortBy] = useState<'newest' | 'score_desc' | 'deal_desc'>('newest');
  
  // Date filter
  const [datePeriod, setDatePeriod] = useState<Period>('this_month');
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' });
  const [filterDateField, setFilterDateField] = useState<'created_at' | 'updated_at'>('created_at');
  const [dateFilterActive, setDateFilterActive] = useState(false);
  
  const [columns, setColumns] = useState<ColumnDef[]>([
    { id: 'name', label: 'Tên liên hệ', visible: true },
    { id: 'email', label: 'Email', visible: true },
    { id: 'phone', label: 'SĐT', visible: true },
    { id: 'score', label: 'Lead Score', visible: false },
    { id: 'company', label: 'Công ty', visible: false },
    { id: 'tags', label: 'Phân loại (Tags)', visible: false },
    { id: 'status', label: 'Trạng thái', visible: true },
    { id: 'contact', label: 'Liên lạc cuối', visible: true },
    { id: 'deal', label: 'Deal hiện tại', visible: false },
    { id: 'owner', label: 'Sale phụ trách', visible: true },
    { id: 'updated_at', label: 'Ngày cập nhật', visible: true },
    { id: 'created_at', label: 'Ngày tạo', visible: true },
  ]);
  const [showColumns, setShowColumns] = useState(false);

  const [total, setTotal] = useState(0);

  const fetchData = async () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      let list = [...state.contacts];
      
      // Basic search
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        list = list.filter(c => 
          (c.first_name + ' ' + c.last_name).toLowerCase().includes(s) || 
          c.email?.toLowerCase().includes(s) || 
          c.phone?.includes(s)
        );
      }

      // Advanced filters mapping for Mock Mode
      if (activeFilters.status) {
        list = list.filter(c => c.status === activeFilters.status);
      }
      if (activeFilters.source) {
        list = list.filter(c => c.source === activeFilters.source);
      }
      if (activeFilters.ownerId) {
        list = list.filter(c => String(c.owner_id) === activeFilters.ownerId);
      }
      if (activeFilters.projectId) {
        list = list.filter(c => String(c.project_id) === activeFilters.projectId);
      }
      if (activeFilters.tag) {
        list = list.filter(c => Array.isArray(c.tags) && c.tags.includes(activeFilters.tag));
      }
      if (activeFilters.dateActive) {
        const field = activeFilters.dateField;
        if (activeFilters.dateType === 'range') {
          if (activeFilters.fromDate) list = list.filter(c => new Date(c[field]) >= new Date(activeFilters.fromDate));
          if (activeFilters.toDate) list = list.filter(c => new Date(c[field]) <= new Date(activeFilters.toDate));
        } else if (activeFilters.dateType === 'before') {
          if (activeFilters.beforeDate) list = list.filter(c => new Date(c[field]) <= new Date(activeFilters.beforeDate));
        } else if (activeFilters.dateType === 'after') {
          if (activeFilters.afterDate) list = list.filter(c => new Date(c[field]) >= new Date(activeFilters.afterDate));
        }
      }

      setContacts(list.map(c => ({ ...c, score: c.lead_score || calcScore(c) })));
      setTotal(list.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = { 
        page, 
        limit: PAGE_SIZE, 
        search: debouncedSearch, 
        sort: sortBy === 'score_desc' ? 'lead_score' : (sortBy === 'deal_desc' ? 'open_deal_value' : 'created_at'),
        order: 'DESC'
      };
      
      if (activeFilters.status) params.status = activeFilters.status;
      if (activeFilters.source) params.source = activeFilters.source;
      if (activeFilters.ownerId) params.owner_id = activeFilters.ownerId;
      if (activeFilters.projectId) params.project_id = activeFilters.projectId;
      if (activeFilters.tag) params.tag = activeFilters.tag;

      if (activeFilters.dateActive) {
        params.date_field = activeFilters.dateField;
        if (activeFilters.dateType === 'range') {
          if (activeFilters.fromDate) params.from = activeFilters.fromDate;
          if (activeFilters.toDate) params.to = activeFilters.toDate;
        } else if (activeFilters.dateType === 'before') {
          if (activeFilters.beforeDate) params.to = activeFilters.beforeDate;
        } else if (activeFilters.dateType === 'after') {
          if (activeFilters.afterDate) params.from = activeFilters.afterDate;
        }
      }

      const r = await api.get('/contacts', { params });
      const data = r.data.data;
      setContacts((data.items || []).map((c: any) => ({ ...c, score: c.lead_score || calcScore(c) })));
      setTotal(data.total || 0);
    } catch (e: any) {
      setContacts([]);
      setTotal(0);
      addToast('Không thể lấy danh sách liên hệ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, debouncedSearch, sortBy, activeFilters]);

  useEffect(() => {
    // Fetch sales/users for assignment once (only for admin/manager who have permission)
    if (user && user.role !== 'sale') {
      api.get('/users').then(r => { const d = r.data.data; setUsers(Array.isArray(d) ? d : (d?.items || [])); }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    api.get('/projects').then(r => {
      const d = r.data.data;
      setProjects(Array.isArray(d) ? d : (d?.items || []));
    }).catch(() => {});
  }, []);

  const handleApplyFilters = () => {
    setPage(1);
    const dateActive = 
      (dateFilterType === 'range' && (filterFromDate || filterToDate)) ||
      (dateFilterType === 'before' && filterBeforeDate) ||
      (dateFilterType === 'after' && filterAfterDate);

    setActiveFilters({
      status: filterStatus,
      source: filterSource,
      ownerId: filterOwnerId,
      projectId: filterProjectId,
      tag: filterTag.trim(),
      dateField: filterDateField as any,
      dateType: dateFilterType,
      fromDate: filterFromDate,
      toDate: filterToDate,
      beforeDate: filterBeforeDate,
      afterDate: filterAfterDate,
      dateActive: !!dateActive
    });
  };

  const handleResetFilters = () => {
    setFilterStatus('');
    setFilterSource('');
    setFilterOwnerId('');
    setFilterProjectId('');
    setFilterTag('');
    setFilterDateField('created_at');
    setDateFilterType('range');
    setFilterFromDate('');
    setFilterToDate('');
    setFilterBeforeDate('');
    setFilterAfterDate('');
    setPage(1);
    setActiveFilters({
      status: '',
      source: '',
      ownerId: '',
      projectId: '',
      tag: '',
      dateField: 'created_at',
      dateType: 'range',
      fromDate: '',
      toDate: '',
      beforeDate: '',
      afterDate: '',
      dateActive: false
    });
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateModal && !creating) {
        setShowCreateModal(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showCreateModal, creating]);

  const paged = contacts;

  const toggleSelect = (id: number) => setSelected(p => { 
    const n = new Set(p); 
    if (n.has(id)) n.delete(id); 
    else n.add(id); 
    return n; 
  });
  const toggleAll = () => setSelected(selected.size===paged.length ? new Set() : new Set(paged.map(c=>c.id)));

  const bulkDelete = () => {
    showConfirm({
      title: `Xóa ${selected.size} liên hệ?`,
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn các liên hệ đã chọn? Thao tác này không thể hoàn tác.`,
      isDanger: true,
      impactInfo: `Cảnh báo: Thao tác này sẽ xóa vĩnh viễn ${selected.size} liên hệ và toàn bộ lịch sử giao dịch liên quan.`,
      requireWordMatch: selected.size > 10 ? 'DELETE' : undefined,
      confirmText: 'Xác nhận xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await api.post('/contacts/bulk-delete', { ids: Array.from(selected) });
          setContacts(p => p.filter(c => !selected.has(c.id)));
          addToast(`Đã xóa ${selected.size} liên hệ thành công`, 'success');
          setSelected(new Set());
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Lỗi khi xóa liên hệ', 'error');
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const bulkExport = () => {
    const params = new URLSearchParams();
    params.set('type', 'contact');
    params.set('token', localStorage.getItem('token') || '');
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (activeFilters.status) params.set('status', activeFilters.status);
    if (activeFilters.source) params.set('source', activeFilters.source);
    if (activeFilters.ownerId) params.set('owner_id', activeFilters.ownerId);
    if (activeFilters.projectId) params.set('project_id', activeFilters.projectId);
    if (activeFilters.tag) params.set('tag', activeFilters.tag);
    if (activeFilters.dateActive) {
      params.set('date_field', activeFilters.dateField);
      params.set('date_type', activeFilters.dateType);
      if (activeFilters.dateType === 'range') {
        if (activeFilters.fromDate) params.set('from', activeFilters.fromDate);
        if (activeFilters.toDate) params.set('to', activeFilters.toDate);
      } else if (activeFilters.dateType === 'before') {
        if (activeFilters.beforeDate) params.set('to', activeFilters.beforeDate);
      } else if (activeFilters.dateType === 'after') {
        if (activeFilters.afterDate) params.set('from', activeFilters.afterDate);
      }
    }
    window.open(`${api.defaults.baseURL}/export?${params.toString()}`, '_blank');
    addToast('Đang tải xuống dữ liệu Export...', 'info');
  };
  const bulkTag    = () => addToast('Mở gán tag hàng loạt...', 'info');
  const bulkEmail  = () => addToast(`Soạn email cho ${selected.size} liên hệ...`, 'info');
  const bulkAssign = () => addToast('Gán nhân viên phụ trách...', 'info');

  const handleCreateContact = async () => {
    if (!createForm.first_name.trim()) { addToast('Vui lòng nhập họ tên', 'error'); return; }
    
    // Yêu cầu ít nhất email hoặc số điện thoại
    if (!createForm.email.trim() && !createForm.phone.trim()) {
      addToast('Vui lòng cung cấp ít nhất Email hoặc Số điện thoại', 'error');
      return;
    }

    setCreating(true);
    try {
      const r = await api.post('/contacts', createForm);
      const newContact = r.data.data;
      setContacts(prev => [newContact, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ first_name: '', last_name: '', email: '', phone: '', company_name: '', job_title: '', status: 'lead', source: 'other', owner_id: '', city: '', ward: '', address: '' });
      addToast('Đã thêm liên hệ mới thành công', 'success');
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Không thể tạo liên hệ', 'error');
    } finally {
      setCreating(false);
    }
  };

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: contacts.length, hot: 0, customer: 0, has_deal: 0, no_contact: 0, new_week: 0 };
    contacts.forEach(c => {
      if (!c) return;
      const days = AGO_DAYS(c.last_contact);
      if (c.score >= 80) counts.hot++;
      if (c.status === 'customer') counts.customer++;
      if ((c.open_deal_value || 0) > 0) counts.has_deal++;
      if (days > 30) counts.no_contact++;
      if (days <= 7) counts.new_week++;
    });
    return counts;
  }, [contacts]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Liên hệ & Khách hàng</h1>
          <p className="page-subtitle">{loading ? '...' : `${total} liên hệ`}</p>
        </div>
        <div className="flex gap-2">
          {!isSale && (
            <button className="btn outline" onClick={() => setShowImportExport(true)} title="Nhập/Xuất Dữ liệu">
              <Download size={14}/>
              <span className="hide-on-mobile"> Nhập/Xuất Dữ liệu</span>
            </button>
          )}
          <button className="btn primary" onClick={() => setShowCreateModal(true)} title="Thêm liên hệ">
            <Plus size={15}/>
            <span className="hide-on-mobile"> Thêm liên hệ</span>
          </button>
        </div>
      </div>

      {/* Smart Segments Removed */}

      {/* Search + filter row */}
      <div className="card" style={{ padding:'0.75rem 1rem', marginBottom:'0.75rem', display:'flex', gap:'0.75rem', alignItems:'center', flexWrap: 'wrap' }}>
        <div className="filter-search" style={{ width: '300px', position: 'relative' }}>
          <Search size={14} style={{ color:'var(--color-text-muted)' }}/>
          <input placeholder="Tìm tên, email, điện thoại..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} style={{ paddingRight: '2rem' }}/>
          <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            <AnimatePresence>
              {search && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="btn-icon-bare" 
                  onClick={() => setSearch('')} 
                  style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Xóa tìm kiếm"
                >
                  <X size={14} style={{ color: 'var(--color-text-muted)' }}/>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Advanced filter toggle */}
        <button 
          className={`btn sm ${showAdvancedFilters ? 'primary' : 'outline'}`} 
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', borderRadius: '10px' }}
        >
          <Filter size={14} />
          <span>Bộ lọc nâng cao</span>
        </button>
        
        <div style={{ flex: 1 }} />
        
        {/* View Mode & Layout Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ width: 170 }}>
            <CustomSelect 
              value={sortBy} 
              onChange={val => setSortBy(val as any)} 
              options={[
                { value: 'newest', label: 'Mới nhất', icon: <ArrowDownUp size={14} /> },
                { value: 'score_desc', label: 'Score giảm dần', icon: <ArrowDownUp size={14} /> },
                { value: 'deal_desc', label: 'Deal lớn nhất', icon: <ArrowDownUp size={14} /> }
              ]} 
            />
          </div>

          <button 
            className={`btn sm ${viewMode === 'list' ? 'primary' : 'ghost'}`} 
            onClick={() => setViewMode('list')} 
            title="Danh sách"
            style={{ padding: '0.5rem' }}
          >
            <List size={16} />
          </button>
          <button 
            className={`btn sm ${viewMode === 'card' ? 'primary' : 'ghost'}`} 
            onClick={() => setViewMode('card')} 
            title="Dạng thẻ"
            style={{ padding: '0.5rem' }}
          >
            <LayoutGrid size={16} />
          </button>
          
          <button 
            className="btn outline" 
            onClick={() => setShowColumns(true)} 
            title="Tùy chỉnh cột"
            style={{ padding: '0 0.75rem' }}
          >
            <Columns size={16} />
          </button>
        </div>
      </div>

      {/* Collapsible Advanced Filters Panel */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', marginBottom: '0.75rem' }}
          >
            <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--color-primary-light)', background: 'var(--color-surface)', borderRadius: '16px' }}>
              {/* Nhóm 1: Thông tin khách hàng */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Thông tin khách hàng
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {/* Trạng thái */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Trạng thái</label>
                    <CustomSelect
                      value={filterStatus}
                      onChange={v => setFilterStatus(v)}
                      options={[
                        { value: '', label: 'Tất cả trạng thái' },
                        { value: 'lead', label: 'Lead mới' },
                        { value: 'qualified', label: 'Đủ điều kiện' },
                        { value: 'customer', label: 'Khách hàng VIP' },
                        { value: 'churned', label: 'Đã rời' }
                      ]}
                    />
                  </div>

                  {/* Dự án */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Dự án giao dịch</label>
                    <CustomSelect
                      value={filterProjectId}
                      onChange={v => setFilterProjectId(v)}
                      options={[
                        { value: '', label: 'Tất cả dự án' },
                        ...projects.map(p => ({ value: String(p.id), label: p.name }))
                      ]}
                    />
                  </div>

                  {/* Nguồn */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Nguồn khách hàng</label>
                    <CustomSelect
                      value={filterSource}
                      onChange={v => setFilterSource(v)}
                      options={SOURCE_OPTIONS}
                    />
                  </div>

                  {/* Sale phụ trách */}
                  {!isSale && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Sale phụ trách</label>
                      <CustomSelect
                        value={filterOwnerId}
                        onChange={v => setFilterOwnerId(v)}
                        options={[
                          { value: '', label: 'Tất cả sales' },
                          ...users.map(u => ({ value: String(u.id), label: u.full_name }))
                        ]}
                      />
                    </div>
                  )}

                  {/* Nhãn / Tags */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Phân loại (Tag)</label>
                    <input
                      className="form-input"
                      placeholder="Nhập tên tag cần lọc..."
                      value={filterTag}
                      onChange={e => setFilterTag(e.target.value)}
                      style={{ height: '38px', borderRadius: '10px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 2: Lọc theo thời gian */}
              <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Bộ lọc thời gian
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {/* Kiểu lọc thời gian */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Lọc theo ngày nào</label>
                    <CustomSelect
                      value={filterDateField}
                      onChange={v => setFilterDateField(v as any)}
                      options={[
                        { value: 'created_at', label: 'Ngày tạo' },
                        { value: 'updated_at', label: 'Ngày cập nhật' },
                        { value: 'last_contact', label: 'Ngày tương tác cuối' }
                      ]}
                    />
                  </div>

                  {/* Kiểu lọc ngày */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Kiểu lọc thời gian</label>
                    <CustomSelect
                      value={dateFilterType}
                      onChange={v => setDateFilterType(v as any)}
                      options={[
                        { value: 'range', label: 'Trong khoảng' },
                        { value: 'before', label: 'Trước ngày' },
                        { value: 'after', label: 'Sau ngày' }
                      ]}
                    />
                  </div>

                  {/* inputs ngày tương ứng */}
                  {dateFilterType === 'range' && (
                    <>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Từ ngày</label>
                        <input type="date" className="form-input" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} style={{ height: '38px', borderRadius: '10px' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Đến ngày</label>
                        <input type="date" className="form-input" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} style={{ height: '38px', borderRadius: '10px' }} />
                      </div>
                    </>
                  )}
                  {dateFilterType === 'before' && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Trước ngày</label>
                      <input type="date" className="form-input" value={filterBeforeDate} onChange={e => setFilterBeforeDate(e.target.value)} style={{ height: '38px', borderRadius: '10px' }} />
                    </div>
                  )}
                  {dateFilterType === 'after' && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px', display: 'block' }}>Sau ngày</label>
                      <input type="date" className="form-input" value={filterAfterDate} onChange={e => setFilterAfterDate(e.target.value)} style={{ height: '38px', borderRadius: '10px' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  className="btn outline sm"
                  onClick={handleResetFilters}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', fontWeight: 600 }}
                >
                  Đặt lại
                </button>
                <button
                  className="btn primary sm"
                  onClick={handleApplyFilters}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', fontWeight: 600 }}
                >
                  Lọc kết quả
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ColumnCustomizer 
        isOpen={showColumns} 
        onClose={() => setShowColumns(false)} 
        columns={columns} 
        onChange={setColumns} 
      />

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ position:'sticky', top:68, zIndex:100, marginBottom:'0.75rem', padding:'0.75rem 1.25rem', background:'var(--color-primary)', borderRadius:'var(--radius-xl)', display:'flex', alignItems:'center', gap:'0.75rem', boxShadow:'0 8px 24px rgba(163, 20, 34,0.3)' }}>
            <span style={{ color:'white', fontWeight:700, fontSize:'0.875rem' }}>{selected.size} đã chọn</span>
            <div style={{ flex:1 }}/>
            {[
              { label:'Email', action:bulkEmail },
              { label:'Tag',   action:bulkTag   },
              ...(!isSale ? [
                { label:'Gán',  action:bulkAssign},
                { label:'Xuất', action:bulkExport },
              ] : [])
            ].map(b=>(
              <button key={b.label} onClick={b.action}
                style={{ padding:'0.375rem 0.875rem', background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'var(--radius-lg)', color:'white', fontWeight:600, fontSize:'0.8125rem', cursor:'pointer' }}>
                {b.label}
              </button>
            ))}
            {!isSale && (
              <button onClick={bulkDelete}
                style={{ padding:'0.375rem 0.875rem', background:'rgba(239,68,68,0.8)', border:'none', borderRadius:'var(--radius-lg)', color:'white', fontWeight:700, fontSize:'0.8125rem', cursor:'pointer' }}>
                Xóa
              </button>
            )}
            <button onClick={() => setSelected(new Set())} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer' }}><X size={16}/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div className="card">
          <TableSkeleton rows={6} cols={6} />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'visible' }}>
          {viewMode === 'list' ? (

            <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', boxShadow: '0 1px 0 var(--color-border)' }}>
                  <tr>
                    <th style={{ width: 44, padding: '1rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <CustomCheckbox 
                        checked={selected.size === paged.length && paged.length > 0} 
                        onChange={toggleAll} 
                      />
                    </th>
                    {columns.find(c => c.id === 'name')?.visible && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Liên hệ</th>}
                    {(columns.find(c => c.id === 'email')?.visible || columns.find(c => c.id === 'phone')?.visible) && (
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Liên lạc</th>
                    )}
                    {columns.find(c => c.id === 'score')?.visible && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Score</th>}
                    {columns.find(c => c.id === 'company')?.visible && !columns.find(c => c.id === 'name')?.visible && (
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Công ty</th>
                    )}
                    {/* {columns.find(c => c.id === 'tags')?.visible && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Tags</th>} */}
                    {columns.find(c => c.id === 'status')?.visible && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Trạng thái</th>}
                    {columns.find(c => c.id === 'contact')?.visible && !columns.find(c => c.id === 'owner')?.visible && (
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Liên lạc cuối</th>
                    )}
                    {columns.find(c => c.id === 'deal')?.visible && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Deal đang mở</th>}
                    {columns.find(c => c.id === 'owner')?.visible && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Sale phụ trách</th>}
                    {columns.find(c => c.id === 'updated_at')?.visible && !columns.find(c => c.id === 'owner')?.visible && (
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Cập nhật</th>
                    )}
                    {columns.find(c => c.id === 'created_at')?.visible && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Ngày tạo</th>}
                    <th style={{ width: 120, padding: '1rem', borderBottom: '1px solid var(--color-border)' }}></th>
                  </tr>
                </thead>

                <tbody>
                  {paged.map(c => {
                    const days = AGO_DAYS(c.last_contact);
                    const fullName = `${c.first_name} ${c.last_name}`;
                    return (
                      <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                         style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', cursor: 'pointer' }}
                         className="table-row-hover"
                         onClick={() => setProfileContact(c)}>
                        <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
                          <CustomCheckbox 
                            checked={selected.has(c.id)} 
                            onChange={() => toggleSelect(c.id)} 
                          />
                        </td>
                        {columns.find(col => col.id === 'name')?.visible && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar name={fullName} size={36} />
                              <div>
                                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{fullName}</p>
                                {columns.find(col => col.id === 'company')?.visible && c.company_name && (
                                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                    {c.company_name} {c.job_title ? `• ${c.job_title}` : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                        {(columns.find(col => col.id === 'email')?.visible || columns.find(col => col.id === 'phone')?.visible) && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {columns.find(col => col.id === 'phone')?.visible && c.phone ? (
                                <PhoneLink phone={c.phone} style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }} />
                              ) : null}
                              {columns.find(col => col.id === 'email')?.visible && c.email ? (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{c.email}</span>
                              ) : null}
                            </div>
                          </td>
                        )}
                        {columns.find(col => col.id === 'score')?.visible && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: c.score >= 80 ? 'var(--color-success)' : c.score >= 60 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                              {c.score}
                            </span>
                          </td>
                        )}
                        {columns.find(col => col.id === 'company')?.visible && !columns.find(col => col.id === 'name')?.visible && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{c.company_name || '—'}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.job_title || ''}</p>
                          </td>
                        )}
                        {/* {columns.find(col => col.id === 'tags')?.visible && (
                          <td style={{ padding: '1rem', maxWidth: 160, borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {(c.tags || []).slice(0, 2).map((t: string) => (
                                <span key={t} style={{ padding: '2px 8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                  {t}
                                </span>
                              ))}
                              {(c.tags || []).length > 2 && (
                                <span style={{ padding: '2px 6px', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>+{c.tags.length - 2}</span>
                              )}
                            </div>
                          </td>
                        )} */}
                        {columns.find(col => col.id === 'status')?.visible && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <span className={`badge ${STATUS_CLASS[c.status] || 'info'}`}>{STATUS_LABEL[c.status] || c.status}</span>
                          </td>
                        )}
                        {columns.find(col => col.id === 'contact')?.visible && !columns.find(col => col.id === 'owner')?.visible && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: '0.8125rem', color: days > 30 ? 'var(--color-danger)' : days > 14 ? 'var(--color-warning)' : 'var(--color-text-muted)', fontWeight: days > 30 ? 700 : 400 }}>
                              {c.last_contact ? (days === 0 ? 'Hôm nay' : days === 1 ? 'Hôm qua' : `${days} ngày trước`) : '—'}
                            </span>
                          </td>
                        )}
                        {columns.find(col => col.id === 'deal')?.visible && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: (c.open_deal_value || 0) > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                              {FMT_VND(c.open_deal_value || 0)}
                            </span>
                          </td>
                        )}
                        {columns.find(col => col.id === 'owner')?.visible && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            {c.owner_name ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Avatar name={c.owner_name} size={32} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{c.owner_name}</span>
                                  <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                    Cập nhật: {c.updated_at ? new Date(c.updated_at).toLocaleDateString('vi-VN') : '—'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                                  <User size={16} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa giao</span>
                                  <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                    Cập nhật: {c.updated_at ? new Date(c.updated_at).toLocaleDateString('vi-VN') : '—'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>
                        )}
                        {columns.find(col => col.id === 'updated_at')?.visible && !columns.find(col => col.id === 'owner')?.visible && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{c.updated_at ? new Date(c.updated_at).toLocaleDateString('vi-VN') : '—'}</p>
                          </td>
                        )}
                        {columns.find(col => col.id === 'created_at')?.visible && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                              {c.created_at ? (() => {
                                const d = new Date(c.created_at);
                                const pad = (n: number) => String(n).padStart(2, '0');
                                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                              })() : '—'}
                            </p>
                          </td>
                        )}
                        <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', opacity: 0 }} className="row-actions">
                            <button className="btn ghost sm" title="Xem hồ sơ" onClick={() => setProfileContact(c)}><Eye size={13} /></button>
                            {!isSale && (
                              <button className="btn ghost sm" style={{ color: 'var(--color-danger)' }} title="Xóa"
                                onClick={() => {
                                  showConfirm({
                                    title: 'Xóa liên hệ',
                                    message: `Bạn có chắc chắn muốn xóa liên hệ ${fullName}? Hành động này không thể hoàn tác.`,
                                    isDanger: true,
                                    confirmText: 'Xóa',
                                    onConfirm: async () => {
                                      try {
                                        await api.delete(`/contacts/${c.id}`);
                                        setContacts(p => p.filter(x => x.id !== c.id));
                                        addToast('Đã xóa liên hệ thành công', 'success');
                                      } catch (e: any) {
                                        addToast(e.response?.data?.message || 'Lỗi khi xóa liên hệ', 'error');
                                      }
                                    }
                                  });
                                }}>
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
              {total === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <Users size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                  <p style={{ fontWeight: 600 }}>Không tìm thấy liên hệ nào</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '1rem', background: 'var(--color-surface)' }}>
              <div className="grid-cards-responsive">
                {paged.map(c => {
                  const days = AGO_DAYS(c.last_contact);
                  const fullName = `${c.first_name} ${c.last_name}`;
                  return (
                    <motion.div 
                      key={c.id} 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setProfileContact(c)}
                      style={{ 
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)', 
                        borderRadius: 'var(--radius-lg)', padding: '1rem', cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s', position: 'relative'
                      }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                    >
                      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }} onClick={e => e.stopPropagation()}>
                        <CustomCheckbox 
                          checked={selected.has(c.id)} 
                          onChange={() => toggleSelect(c.id)} 
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem' }}>
                          {(c.first_name?.[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{fullName}</h3>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Building2 size={12} /> {c.company_name || 'Cá nhân'}
                          </p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                        <span className={`badge ${STATUS_CLASS[c.status] || 'info'}`}>{STATUS_LABEL[c.status] || c.status}</span>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--color-bg)', borderRadius: 'var(--radius-full)', fontWeight: 600, color: c.score >= 80 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                          Score: {c.score}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
                        <div>
                          <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>Liên lạc cuối</p>
                          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: days > 30 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                            {c.last_contact ? (days === 0 ? 'Hôm nay' : days === 1 ? 'Hôm qua' : `${days} ngày trước`) : '—'}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>Deal đang mở</p>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: (c.open_deal_value || 0) > 0 ? 'var(--color-primary)' : 'var(--color-text)' }}>
                            {FMT_VND(c.open_deal_value || 0)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {total === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <Users size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                  <p style={{ fontWeight: 600 }}>Không tìm thấy liên hệ nào</p>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem', marginTop: '1rem', width: '100%' }}>
            <Pagination total={total} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
          </div>
        </div>
      )}

      {/* 360° Profile Drawer */}
      <CustomerProfileDrawer
        isOpen={!!profileContact}
        onClose={() => setProfileContact(null)}
        contact={profileContact}
        onUpdate={updated => { setContacts(p=>p.map(c=>c.id===updated?.id?{...c,...updated}:c)); }}
      />
      
      <ImportExportModal 
        isOpen={showImportExport} 
        onClose={() => setShowImportExport(false)} 
        entityName="Liên hệ" 
        onExport={(format) => {
          bulkExport();
        }}
      />

      {/* Quick Create Contact Modal - Enhanced UI */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showCreateModal && (
            <motion.div 
            className="overlay-backdrop" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => !creating && setShowCreateModal(false)} 
            style={{ zIndex: 1000 }}
          >
            <motion.div
              className="modal-sheet"
              initial={isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.95, y: 20 }}
              animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
              style={isMobile ? { 
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
                maxWidth: '100vw', zIndex: 1010, overflow: 'hidden', borderRadius: 0,
                display: 'flex', flexDirection: 'column'
              } : { 
                width: 640, 
                maxWidth: 'calc(100vw - 2rem)', zIndex: 1010, overflow: 'visible',
                margin: 'auto'
              }}
            >
              {/* Header */}
              <div className="modal-header" style={{ padding: isMobile ? '1.25rem' : '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.75rem' : '1.25rem' }}>
                  <div style={{ width: isMobile ? 40 : 52, height: isMobile ? 40 : 52, borderRadius: '16px', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={isMobile ? 20 : 26} style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Thêm Liên hệ mới</h3>
                    <p style={{ fontSize: isMobile ? '0.75rem' : '0.875rem', color: 'var(--color-text-light)', marginTop: 2 }}>{isMobile ? 'Nhập thông tin để quản lý khách hàng' : 'Nhập thông tin cơ bản để bắt đầu quản lý khách hàng'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)} 
                  className="btn-icon-bare" 
                  disabled={creating}
                ><X size={isMobile ? 20 : 24} /></button>
              </div>

              {/* Body */}
              <div className="modal-body" style={{ padding: isMobile ? '1.25rem' : '2.5rem', overflowY: 'auto' }}>
                {/* Name row */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Họ <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input className="form-input lg" placeholder="VD: Nguyễn" value={createForm.first_name} onChange={e => setCreateForm(f => ({ ...f, first_name: e.target.value }))} autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Tên đệm & Tên</label>
                    <input className="form-input lg" placeholder="VD: Văn An" value={createForm.last_name} onChange={e => setCreateForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>

                {/* Contact row */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Số điện thoại</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input lg" style={{ paddingLeft: '3rem' }} placeholder="09xx xxx xxx" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
                      <Phone size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.7 }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Email liên hệ</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input lg" style={{ paddingLeft: '3rem' }} type="email" placeholder="email@congty.com" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
                      <Mail size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.7 }} />
                    </div>
                  </div>
                </div>

                {/* Company + Job */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Công ty / Tổ chức</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input lg" style={{ paddingLeft: '3rem' }} placeholder="Tên công ty..." value={createForm.company_name} onChange={e => setCreateForm(f => ({ ...f, company_name: e.target.value }))} />
                      <Building2 size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.7 }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Chức vụ</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input lg" style={{ paddingLeft: '3rem' }} placeholder="VD: Giám đốc, Kế toán..." value={createForm.job_title} onChange={e => setCreateForm(f => ({ ...f, job_title: e.target.value }))} />
                      <Briefcase size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.7 }} />
                    </div>
                  </div>
                </div>

                {/* Status + Source */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Trạng thái Lead</label>
                    <CustomSelect 
                      options={[
                        { value: 'lead', label: 'Lead mới (Chưa xử lý)' },
                        { value: 'qualified', label: 'Đủ điều kiện (Qualified)' },
                        { value: 'customer', label: 'Khách hàng (Closed Won)' }
                      ]} 
                      value={createForm.status} 
                      onChange={val => setCreateForm(f => ({ ...f, status: val.toString() }))} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Phụ trách bởi (Sale)</label>
                    {isSale ? (
                      <input 
                        className="form-input lg" 
                        value={user?.name || user?.username || ''} 
                        readOnly 
                        disabled 
                        style={{ background: 'var(--color-bg)', cursor: 'not-allowed' }}
                      />
                    ) : (
                      <CustomSelect 
                        options={users.map(u => ({ 
                          value: u.id, 
                          label: u.full_name || u.name, 
                          avatar: u.avatar_url,
                          sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                        }))}
                        value={createForm.owner_id}
                        onChange={val => setCreateForm(f => ({ ...f, owner_id: val.toString() }))}
                        placeholder="Chọn sale phụ trách..."
                        searchable
                        showAvatars
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Nguồn khách hàng</label>
                  <CustomSelect 
                    options={[
                      { value: 'website', label: 'Đăng ký từ Website' },
                      { value: 'referral', label: 'Được giới thiệu' },
                      { value: 'social', label: 'Mạng xã hội (FB/Zalo)' },
                      { value: 'cold_call', label: 'Telesale / Cold Call' },
                      { value: 'event', label: 'Sự kiện / Workshop' },
                      { value: 'other', label: 'Nguồn khác' }
                    ]} 
                    value={createForm.source} 
                    onChange={val => setCreateForm(f => ({ ...f, source: val.toString() }))} 
                  />
                </div>
                <div className="form-group" style={{ marginTop: isMobile ? '1rem' : '1.5rem' }}>
                  <AddressSelect 
                    label="Địa chỉ khách hàng"
                    value={createForm.address || ''}
                    onChange={addr => setCreateForm(f => ({ ...f, address: addr }))}
                    placeholder="Chọn địa chỉ..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{ padding: isMobile ? '1rem 1.25rem' : '1.5rem 2.5rem' }}>
                <button className={`btn outline ${isMobile ? 'sm' : 'lg'}`} onClick={() => setShowCreateModal(false)} disabled={creating}>Hủy bỏ</button>
                <button 
                  className={`btn primary ${isMobile ? 'sm' : 'lg'}`} 
                  onClick={handleCreateContact} 
                  disabled={creating} 
                  style={{ minWidth: isMobile ? 140 : 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                  {creating ? <Loader2 size={20} className="spin" /> : <Plus size={20} />}
                  {creating ? 'Đang khởi tạo...' : 'Tạo Liên hệ'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    , document.body)}
    </div>
  );
};
