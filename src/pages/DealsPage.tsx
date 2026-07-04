import React, { useState, useMemo, useEffect } from 'react';
import { Pagination } from '../components/ui/Pagination';
import { Plus, GripVertical, Pencil, Trash2, Calendar, Target, DollarSign, MessageSquare, Building2, Loader2, Search, Filter, Users, User, CheckCircle2, Phone, Mail, LayoutGrid, List, Clock, Download, RefreshCw, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import confetti from 'canvas-confetti';
import { useUIStore } from '../store/uiStore';
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import { CompanyDrawer } from './CompanyDrawer';
import { DealDrawer } from './DealDrawer';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import api from '../api/axios';
import { DEV_MODE } from '../config/env';
import { useAuthStore } from '../store/authStore';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { useDebounce } from '../hooks/useDebounce';

const FMT = (n: number) => {
  if (!n) return '0 đ';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'T';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return (n / 1e3).toFixed(0) + 'K';
};

export const DealsPage: React.FC = () => {
  const { addToast } = useUIStore();
  const [showImportExport, setShowImportExport] = useState(false);
  const [pipelineView, setPipelineView] = useState<'deals' | 'contacts' | 'companies'>('contacts');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeStageFilter, setActiveStageFilter] = useState<string | number>('all');
  const [stages, setStages] = useState<any[]>([]);
  const stagesRef = React.useRef<any[]>([]);
  React.useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);
  const [items, setItems] = useState<Record<number, any[]>>({});

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Drawers
  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [showCompanyDrawer, setShowCompanyDrawer] = useState(false);
  const [showDealDrawer, setShowDealDrawer] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  
  const [dragging, setDragging] = useState<{ id: number, fromStage: number } | null>(null);
  const [transitionModal, setTransitionModal] = useState<{ isOpen: boolean; itemId: number; toStage: number; fromStage: number; note: string } | null>(null);
  const [stagePickerItem, setStagePickerItem] = useState<{ id: number, fromStageId: number } | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeStageMobile, setActiveStageMobile] = useState<string | number>('');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (stages.length > 0 && !activeStageMobile) {
      setActiveStageMobile(stages[0].id);
    }
  }, [stages]);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [dateFilterType, setDateFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStage, setFilterStage] = useState('');
  
  // Temp states for Filter Panel
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [tempDateType, setTempDateType] = useState('');
  const [tempDateFrom, setTempDateFrom] = useState('');
  const [tempDateTo, setTempDateTo] = useState('');
  const [tempAssignee, setTempAssignee] = useState('');
  const [tempStage, setTempStage] = useState('');
  
  const [activeFilterPill, setActiveFilterPill] = useState<string>('');
  
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [targetStageId, setTargetStageId] = useState<string>('');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  const filteredItems = useMemo(() => {
    const result: Record<string, any[]> = {};
    Object.keys(items).forEach(stageIdStr => {
      const stageItems = items[stageIdStr as any] || [];
      result[stageIdStr] = stageItems.filter(item => {
        // Text Search
        if (debouncedSearch) {
          const lowerSearch = debouncedSearch.toLowerCase();
          const nameMatch = pipelineView === 'contacts' 
            ? `${item.first_name || ''} ${item.last_name || ''} ${item.email || ''}`.toLowerCase().includes(lowerSearch)
            : (pipelineView === 'companies'
                ? `${item.name || ''} ${item.email || ''}`.toLowerCase().includes(lowerSearch)
                : `${item.title || ''} ${item.company_name || ''}`.toLowerCase().includes(lowerSearch));
          
          if (!nameMatch) return false;
        }
        // Date Filter
        const dateToCheck = item.updated_at || item.created_at;
        if (dateToCheck && dateFilterType) {
          const itemDate = new Date(dateToCheck.split(' ')[0]);
          const today = new Date();
          today.setHours(0,0,0,0);
          
          if (dateFilterType === 'today') {
            if (itemDate.getTime() !== today.getTime()) return false;
          } else if (dateFilterType === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (itemDate.getTime() !== yesterday.getTime()) return false;
          } else if (dateFilterType === 'this_week') {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Monday
            if (itemDate < startOfWeek) return false;
          } else if (dateFilterType === 'this_month') {
            if (itemDate.getMonth() !== today.getMonth() || itemDate.getFullYear() !== today.getFullYear()) return false;
          } else if (dateFilterType === 'this_year') {
            if (itemDate.getFullYear() !== today.getFullYear()) return false;
          } else if (dateFilterType === 'custom') {
            if (filterDateFrom && dateToCheck.split(' ')[0] < filterDateFrom) return false;
            if (filterDateTo && dateToCheck.split(' ')[0] > filterDateTo) return false;
          }
        }
        // Assignee Filter
        if (filterAssignee && String(item.owner_id) !== String(filterAssignee)) return false;
        // Stage Filter
        if (filterStage && String(item.stage_id) !== String(filterStage)) return false;
        
        return true;
      });
    });
    return result;
  }, [items, debouncedSearch, dateFilterType, filterDateFrom, filterDateTo, filterAssignee, filterStage, pipelineView]);

  const getVisibleItems = () => {
    return Object.values(filteredItems)
      .flat()
      .filter(item => activeStageFilter === 'all' || String(item.stage_id) === String(activeStageFilter));
  };

  const totalVisibleCount = total;
  const totalPages = Math.ceil(totalVisibleCount / limit);
  const pagedItems = getVisibleItems(); // Already paged by backend in list mode, or all items in kanban mode (limit 500)

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageAll = () => {
    const pageIds = pagedItems.map(v => v.id);
    const allPageSelected = pageIds.every(id => selected.has(id));
    
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const selectAllEntireQuery = () => {
    setSelected(new Set(getVisibleItems().map(v => v.id)));
  };

  const bulkExport = () => {
    window.open(`${api.defaults.baseURL}/export?type=deal&token=${localStorage.getItem('token')}`, '_blank');
    addToast('Đang tải xuống dữ liệu Export...', 'info');
  };

  const bulkMove = async () => {
    if (!targetStageId) return;
    try {
      const ids = Array.from(selected);
      // In a real app, this would be one API call
      await Promise.all(ids.map(id => api.patch(`/${pipelineView}/${id}/stage`, { stage_id: targetStageId, note: 'Bulk move' })));
      
      fetchData(); // Refresh all
      
      addToast(`Đã chuyển ${selected.size} thẻ sang giai đoạn mới`, 'success');
      setSelected(new Set());
      setShowBulkMove(false);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi chuyển giai đoạn', 'error');
    }
  };

  const fetchUsers = async () => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && (currentUser.role === 'sale' || currentUser.role === 'sales')) {
      return;
    }
    try {
      const r = await api.get('/users');
      setAllUsers(r.data.data || []);
    } catch (e: any) {
      console.error("Failed to fetch users", e);
    }
  };

  const fetchStages = async () => {
    try {
      const r = await api.get('/pipeline-stages');
      const stagesData = r.data.data || [];
      const sorted = [...stagesData].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setStages(sorted);
    } catch (e: any) {
      setStages([]);
    }
  };

  const fetchData = async () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      let list = pipelineView === 'contacts' ? [...state.contacts] : (pipelineView === 'companies' ? [...state.companies] : [...state.deals]);
      
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        if (pipelineView === 'contacts') {
          list = list.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s));
        } else if (pipelineView === 'companies') {
          list = list.filter(c => c.name.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s));
        } else {
          list = list.filter(c => c.title?.toLowerCase().includes(s) || c.company_name?.toLowerCase().includes(s));
        }
      }
      
      if (filterAssignee) {
        list = list.filter(c => String(c.owner_id) === String(filterAssignee));
      }

      const grouped: Record<number, any[]> = {};
      list.forEach((d: any) => {
        const sid = (!d.stage_id || d.stage_id === '0' || d.stage_id === 0 || d.stage_id === 'unassigned')
          ? (stagesRef.current.length > 0 ? stagesRef.current[0].id : 'unassigned')
          : d.stage_id;
        if (!grouped[sid as any]) grouped[sid as any] = [];
        grouped[sid as any].push(d);
      });
      

      
      setItems(grouped);
      setTotal(list.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const endpoint = pipelineView === 'contacts' ? '/contacts' : (pipelineView === 'companies' ? '/companies' : '/deals');
      const params: any = {
        page: viewMode === 'kanban' ? 1 : page,
        limit: viewMode === 'kanban' ? 500 : limit,
        search: debouncedSearch,
        owner_id: filterAssignee,
        stage_id: filterStage,
      };

      if (dateFilterType && (filterDateFrom || filterDateTo)) {
        params.from = filterDateFrom;
        params.to = filterDateTo;
      }

      const r = await api.get(endpoint, { params });
      const dataItems = r.data.data?.items || [];
      const grouped: Record<number, any[]> = {};
      dataItems.forEach((d: any) => {
        const sid = (!d.stage_id || d.stage_id === '0' || d.stage_id === 0) 
          ? (stagesRef.current.length > 0 ? stagesRef.current[0].id : 0) 
          : d.stage_id;
        if (!grouped[sid]) grouped[sid] = [];
        grouped[sid].push(d);
      });

      setItems(grouped);
      setTotal(r.data.data?.total || dataItems.length);
    } catch (e: any) {
      console.error("Failed to fetch data", e);
      setItems({});
    } finally { setLoading(false); }
  };


  useEffect(() => {
    fetchUsers();
    fetchStages().then(() => fetchData());
  }, [pipelineView]);

  useEffect(() => {
    if (stages.length > 0) fetchData();
  }, [stages, pipelineView, page, debouncedSearch, filterAssignee, filterStage, filterDateFrom, filterDateTo, viewMode]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (transitionModal?.isOpen) setTransitionModal(null);
        if (showBulkMove) setShowBulkMove(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [transitionModal, showBulkMove]);

  // Update a single item in the local items state without a full refetch
  const updateItemLocally = (updated: any) => {
    setItems(prev => {
      const next: Record<number, any[]> = {};
      Object.keys(prev).forEach(sid => {
        next[sid as any] = (prev[sid as any] || []).map((it: any) =>
          it.id === updated.id ? { ...it, ...updated } : it
        );
      });
      return next;
    });
  };

  const handleDrop = (toStage: number) => {
    if (!dragging || dragging.fromStage === toStage) return;
    setTransitionModal({
      isOpen: true,
      itemId: dragging.id,
      fromStage: dragging.fromStage,
      toStage: toStage,
      note: ''
    });
    setDragging(null);
  };

  const handleConfirmTransition = async () => {
    if (!transitionModal) return;
    if (!transitionModal.note.trim()) { addToast('Vui lòng nhập ghi chú bắt buộc (Audit Trail)', 'warning'); return; }

    try {
      const endpoint = pipelineView === 'contacts' ? `/contacts/${transitionModal.itemId}/stage` : (pipelineView === 'companies' ? `/companies/${transitionModal.itemId}/stage` : `/deals/${transitionModal.itemId}/stage`);
      await api.patch(endpoint, { 
        stage_id: transitionModal.toStage,
        note: transitionModal.note
      });
      fetchData(); // Refresh
      
      const item = items[transitionModal.fromStage]?.find(d => d.id === transitionModal.itemId);
      const toStage = stages.find(s => s.id === transitionModal.toStage);
      if (toStage?.is_won) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        addToast(`TUYỆT VỜI! Chúc mừng bạn đã chốt thành công "${pipelineView === 'contacts' ? item?.first_name : (pipelineView === 'companies' ? item?.name : item?.title)}"`, 'success');
      } else {
        addToast('Đã chuyển trạng thái & lưu Audit Log', 'success');
      }
    } catch (err: any) { addToast(err.response?.data?.message || 'Lỗi khi di chuyển thẻ', 'error'); }
    
    setTransitionModal(null);
  };

  const totalRevenue = Object.values(filteredItems).flat().reduce((sum, d) => sum + (Number(d.expected_revenue) || Number(d.value) || 0), 0);

  const filterPills = [
    { id: '', label: 'Tất cả' },
    { id: 'my', label: 'Của tôi' },
    { id: 'recent', label: 'Tương tác gần đây' },
    { id: 'won', label: 'Đã chốt' }
  ];

  const currentUserId = useAuthStore.getState().user?.id;
  const handlePillClick = (id: string) => {
    setActiveFilterPill(id);
    if (id === 'my') {
      setFilterAssignee(String(currentUserId || 1));
    } else {
      setFilterAssignee('');
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem', flexShrink: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={24} color="var(--color-primary)" />
            Pipeline {pipelineView === 'deals' ? 'Cơ hội' : (pipelineView === 'contacts' ? 'Khách hàng' : 'Doanh nghiệp')}
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.9375rem', marginTop: '4px' }}>
            <strong>{Object.values(items).flat().length}</strong> thẻ đang quản lý · Tổng giá trị dự kiến: <strong style={{ color: 'var(--color-primary)', fontSize: '1.25rem', marginLeft: '4px' }}>{FMT(totalRevenue)}</strong>
          </p>
        </div>
        <div style={{ flex: 1 }} />

        {/* Kanban vs List Toggle */}
        <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-md)', marginRight: '1rem', height: 38, border: '1px solid var(--color-border)' }}>
          <button 
            className={`btn ${viewMode === 'kanban' ? 'primary' : 'ghost'}`} 
            style={{ borderRadius: 'var(--radius-sm)', padding: '0 10px', height: 28, minWidth: 32, fontSize: '0.8rem' }}
            onClick={() => setViewMode('kanban')}
            title="Dạng bảng (Kanban)"
          ><LayoutGrid size={15}/></button>
          <button 
            className={`btn ${viewMode === 'list' ? 'primary' : 'ghost'}`} 
            style={{ borderRadius: 'var(--radius-sm)', padding: '0 10px', height: 28, minWidth: 32, fontSize: '0.8rem' }}
            onClick={() => setViewMode('list')}
            title="Dạng danh sách"
          ><List size={15}/></button>
        </div>

        {/* Mobile Pipeline Selector Dropdown */}
        <div className="mobile-only" style={{ marginRight: '0.5rem' }}>
          <select 
            value={pipelineView} 
            onChange={e => setPipelineView(e.target.value as any)}
            className="form-select"
            style={{ height: 38, borderRadius: 'var(--radius-md)', padding: '0 10px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.875rem' }}
          >
            <option value="contacts">KH</option>
            <option value="deals">Cơ hội</option>
            <option value="companies">DN</option>
          </select>
        </div>

        {/* Desktop Pipeline Tabs Switcher */}
        <div className="hide-on-mobile" style={{ display: 'flex', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-md)', height: 38, marginRight: '1rem', border: '1px solid var(--color-border)' }}>
          <button 
            className={`btn ${pipelineView === 'contacts' ? 'primary' : 'ghost'}`} 
            style={{ borderRadius: 'var(--radius-sm)', height: 28, padding: '0 10px', fontSize: '0.8rem' }}
            onClick={() => setPipelineView('contacts')}
          >
            <User size={14} /> Khách hàng
          </button>
          <button 
            className={`btn ${pipelineView === 'deals' ? 'primary' : 'ghost'}`} 
            style={{ borderRadius: 'var(--radius-sm)', height: 28, padding: '0 10px', fontSize: '0.8rem' }}
            onClick={() => setPipelineView('deals')}
          >
            <DollarSign size={14} /> Cơ hội
          </button>
          <button 
            className={`btn ${pipelineView === 'companies' ? 'primary' : 'ghost'}`} 
            style={{ borderRadius: 'var(--radius-sm)', height: 28, padding: '0 10px', fontSize: '0.8rem' }}
            onClick={() => setPipelineView('companies')}
          >
            <Building2 size={14} /> Doanh nghiệp
          </button>
        </div>

        <button className="btn outline" style={{ height: 38, borderRadius: 'var(--radius-md)', marginRight: '0.5rem', fontSize: '0.8rem', padding: '0 12px' }} onClick={() => setShowImportExport(true)} title="Nhập/Xuất">
          <Download size={14} />
          <span className="hide-on-mobile" style={{ marginLeft: '0.25rem' }}> Nhập/Xuất</span>
        </button>

      </div>

      <ImportExportModal 
        isOpen={showImportExport} 
        onClose={() => setShowImportExport(false)} 
        entityName={pipelineView === 'deals' ? 'Cơ hội' : (pipelineView === 'contacts' ? 'Liên hệ' : 'Công ty')}
        onExport={() => {
            const type = pipelineView === 'deals' ? 'deal' : (pipelineView === 'contacts' ? 'contact' : 'company');
            window.open(`${api.defaults.baseURL}/export?type=${type}&token=${localStorage.getItem('token')}`, '_blank');
        }}
      />

      {/* Filter Bar / Bulk Action Bar */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem', position: 'relative' }}>
        <AnimatePresence mode="wait">
          {selected.size > 0 ? (
            <motion.div 
              key="bulk-actions"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-primary)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 12px rgba(163, 20, 34,0.2)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{selected.size} đã chọn</span>
                {selected.size > 0 && selected.size < totalVisibleCount && (
                  <button className="btn ghost sm" style={{ color: 'white', textDecoration: 'underline', padding: '0 4px' }} onClick={selectAllEntireQuery}>
                    Chọn tất cả {totalVisibleCount} thẻ
                  </button>
                )}
              </div>
              
              <div style={{ flex: 1 }} />
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn ghost sm" style={{ color: 'var(--color-text)' }} onClick={bulkExport}>
                  <Download size={14} /> Xuất CSV
                </button>
                <button className="btn primary sm" onClick={() => setShowBulkMove(true)}>
                  <RefreshCw size={14} /> Chuyển Giai đoạn
                </button>
                <button className="btn ghost sm" onClick={() => setSelected(new Set())}>
                  <X size={16} /> Hủy
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="filters"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="filter-search" style={{ width: '400px', position: 'relative' }}>
                  <Search size={14} style={{ color:'var(--color-text-muted)' }}/>
                  <input placeholder="Tìm tên, email, điện thoại..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} style={{ paddingRight: '2rem' }} />
                  <AnimatePresence>
                    {searchTerm && (
                      <motion.button 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className="btn-icon-bare" 
                        onClick={() => setSearchTerm('')} 
                        style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', padding: 4 }}
                        title="Xóa tìm kiếm"
                      >
                        <X size={14} style={{ color: 'var(--color-text-muted)' }}/>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
                
                <div style={{ flex: 1 }} />

                <button className={`btn ${showFilterPanel ? 'primary' : 'outline'}`} onClick={() => setShowFilterPanel(!showFilterPanel)} style={{ borderRadius: 'var(--radius-md)', padding: '0 1rem', height: 38, fontSize: '0.8125rem' }}>
                  <Filter size={14} /> {showFilterPanel ? 'Đóng bộ lọc' : 'Bộ lọc nâng cao'}
                </button>
              </div>

              {/* The Filter Panel */}
              {showFilterPanel && (
                <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', marginTop: '0.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                   {/* Phụ trách */}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Sale phụ trách</label>
                       <CustomSelect 
                         options={[{value: '', label: 'Tất cả Sale'}, ...allUsers.map(u => ({
                           value: String(u.id), 
                           label: u.full_name,
                           avatar: u.avatar_url,
                           sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                         }))]} 
                         value={filterAssignee} 
                         onChange={v => setFilterAssignee(v as string)} 
                         showAvatars
                         searchable
                       />
                   </div>
                   {/* Giai đoạn */}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Giai đoạn</label>
                      <CustomSelect options={[{value: '', label: 'Tất cả giai đoạn'}, ...stages.map(s => ({value: String(s.id), label: s.name}))]} value={filterStage} onChange={v => setFilterStage(v as string)} />
                   </div>
                   {/* Khoảng ngày */}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Thời gian</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <CustomSelect 
                          options={[
                            { value: '', label: 'Tất cả thời gian' },
                            { value: 'today', label: 'Hôm nay' },
                            { value: 'yesterday', label: 'Hôm qua' },
                            { value: 'this_week', label: 'Tuần này' },
                            { value: 'this_month', label: 'Tháng này' },
                            { value: 'this_year', label: 'Năm này' },
                            { value: 'custom', label: 'Tùy chỉnh khoảng ngày' },
                          ]} 
                          value={dateFilterType} 
                          onChange={v => setDateFilterType(v as string)} 
                        />
                        {dateFilterType === 'custom' && (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
                            <input type="date" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8125rem', flex: 1 }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                            <input type="date" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8125rem', flex: 1 }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              )}

              {/* Quick Filter Pills */}
              <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px', marginTop: '0.25rem' }}>
                {filterPills.map(pill => (
                  <button key={pill.id} onClick={() => handlePillClick(pill.id)}
                    style={{ 
                      padding: '5px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600, 
                      border: `1.5px solid ${activeFilterPill === pill.id ? 'var(--color-primary)' : 'var(--color-border-light)'}`, 
                      background: activeFilterPill === pill.id ? 'var(--color-primary-light)' : 'var(--color-surface)', 
                      color: activeFilterPill === pill.id ? 'var(--color-primary)' : 'var(--color-text-light)', 
                      cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
                    }}>
                    {pill.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {viewMode === 'list' && (
        <div className="no-scrollbar" style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '1rem', scrollbarWidth: 'none', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>Giai đoạn:</span>
          <button
            onClick={() => setActiveStageFilter('all')}
            style={{
              padding: '6px 16px', borderRadius: '99px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
              border: `1px solid ${activeStageFilter === 'all' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: activeStageFilter === 'all' ? 'var(--color-primary-light)' : 'var(--color-surface)',
              color: activeStageFilter === 'all' ? 'var(--color-primary)' : 'var(--color-text-light)',
            }}
          >
            Tất cả ({Object.values(filteredItems).flat().length})
          </button>
          {stages.map(stage => {
            const count = (filteredItems[stage.id] || []).length;
            const isActive = activeStageFilter === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStageFilter(stage.id)}
                style={{
                  padding: '6px 16px', borderRadius: '99px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  border: `1px solid ${isActive ? stage.color || 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: isActive ? `${stage.color || 'var(--color-primary)'}15` : 'var(--color-surface)',
                  color: isActive ? stage.color || 'var(--color-primary)' : 'var(--color-text-light)',
                }}
              >
                {stage.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {isMobile && viewMode === 'kanban' && (
        <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 1rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border-light)', marginBottom: '0.75rem', flexShrink: 0 }}>
          {stages.map(stage => {
            const isActive = activeStageMobile === stage.id;
            const count = (filteredItems[stage.id] || []).length;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStageMobile(stage.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '99px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  border: `1px solid ${isActive ? stage.color || 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: isActive ? `${stage.color || 'var(--color-primary)'}15` : 'var(--color-surface)',
                  color: isActive ? stage.color || 'var(--color-primary)' : 'var(--color-text-light)',
                }}
              >
                {stage.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      {viewMode === 'kanban' ? (
        <div className="card no-scrollbar" style={{ 
          display: 'flex', 
          gap: isMobile ? '0.75rem' : '1.25rem', 
          overflowX: 'auto', 
          padding: isMobile ? '0.75rem' : '1.5rem', 
          paddingBottom: '2rem', 
          flex: 1, 
          alignItems: 'flex-start', 
          scrollSnapType: 'x mandatory',
          background: `
            linear-gradient(to right, var(--color-surface) 30%, transparent),
            linear-gradient(to left, var(--color-surface) 30%, transparent) 100% 0,
            linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent),
            linear-gradient(to left, rgba(0, 0, 0, 0.08), transparent) 100% 0
          `,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '32px 100%, 32px 100%, 12px 100%, 12px 100%',
          backgroundAttachment: 'local, local, scroll, scroll'
        }}>
          {loading ? (
            // Skeleton columns while loading
            <>
              {(isMobile ? [1] : [1, 2, 3, 4]).map(i => (
                <div key={i} style={{ minWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : 320, flexShrink: 0, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '3px solid var(--color-border)' }}>
                    <div style={{ height: 18, width: 120, background: '#e9ecef', borderRadius: 6, marginBottom: 8 }} />
                    <div style={{ height: 14, width: 60, background: '#f1f3f5', borderRadius: 6 }} />
                  </div>
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[1, 2].map(j => (
                      <div key={j} style={{ background: '#f8f9fa', borderRadius: 'var(--radius-lg)', padding: '1.25rem', animation: 'pulse 1.5s ease-in-out infinite' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e9ecef' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 14, width: '70%', background: '#dee2e6', borderRadius: 4, marginBottom: 6 }} />
                            <div style={{ height: 11, width: '50%', background: '#e9ecef', borderRadius: 4 }} />
                          </div>
                        </div>
                        <div style={{ height: 11, width: '60%', background: '#e9ecef', borderRadius: 4, marginBottom: 6 }} />
                        <div style={{ height: 11, width: '80%', background: '#e9ecef', borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : stages.map(stage => {
            if (isMobile && activeStageMobile !== stage.id) return null;
            const stageItems = filteredItems[stage.id] || [];
            const total = stageItems.reduce((s, d) => s + (Number(d.expected_revenue) || 0), 0);

            return (
              <div key={stage.id}
                style={{ 
                  minWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : 320, flexShrink: 0, 
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex', flexDirection: 'column', maxHeight: '100%',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  scrollSnapAlign: 'center'
                }}
                onDragOver={e => { 
                  e.preventDefault(); 
                  e.currentTarget.style.background = 'var(--color-primary-light)'; 
                  e.currentTarget.style.border = '2px dashed var(--color-primary)';
                  e.currentTarget.style.transform = 'scale(1.01)';
                }}
                onDragLeave={e => { 
                  e.currentTarget.style.background = 'var(--color-surface)'; 
                  e.currentTarget.style.border = '1px solid var(--color-border)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                onDrop={e => { 
                  e.currentTarget.style.background = 'var(--color-surface)'; 
                  e.currentTarget.style.border = '1px solid var(--color-border)';
                  e.currentTarget.style.transform = 'scale(1)';
                  handleDrop(stage.id); 
                }}
              >
                {/* Stage Header */}
                <div style={{ padding: '1rem 1.25rem', borderBottom: `3px solid ${stage.color || 'var(--color-primary)'}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{stage.name}</h3>
                      <span style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', padding: '2px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700 }}>{stageItems.length}</span>
                    </div>
                    </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                    {FMT(total)}
                  </div>
                </div>

                {/* Cards Container */}
                <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <AnimatePresence>
                    {stageItems.map(item => {
                      const itemName = pipelineView === 'contacts' ? `${item.first_name} ${item.last_name || ''}`.trim() : (pipelineView === 'companies' ? item.name : item.title);
                      return (
                      <motion.div key={item.id}
                        draggable
                        onDragStart={() => setDragging({ id: item.id, fromStage: stage.id })}
                        onDragEnd={() => setDragging(null)}
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} layout
                        style={{ 
                          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '0.875rem 1rem', 
                          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-light)', 
                          cursor: 'grab', userSelect: 'none', position: 'relative'
                        }}
                        onClick={() => {
                          if (pipelineView === 'deals') { setSelectedDeal(item); setShowDealDrawer(true); }
                          else if (pipelineView === 'contacts') { setSelectedContact(item); setShowContactDrawer(true); }
                          else { setSelectedCompany(item); setShowCompanyDrawer(true); }
                        }}
                        whileHover={{ y: -2, boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}
                        whileTap={{ cursor: 'grabbing' }}
                      >
                        {/* Header: Avatar and Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
                           <Avatar name={itemName} src={item.avatar_url} size={38} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h4 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {itemName}
                            </h4>
                            {item.company_name && (
                              <p style={{ fontSize: '0.73rem', color: 'var(--color-text-light)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                <Building2 size={11} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.company_name}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Body: Contact Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.875rem' }}>
                          {item.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              <Phone size={13} style={{ color: 'var(--color-text-light)', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.phone}</span>
                            </div>
                          )}
                          {item.email && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              <Mail size={13} style={{ color: 'var(--color-text-light)', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Footer: Pipeline Update Time & Owner */}
                        <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-light)' }} title="Cập nhật Pipeline lần cuối">
                             <Clock size={12} />
                             <span>{item.updated_at ? item.updated_at.substring(0,10) : (item.created_at?.substring(0,10) || '')}</span>
                           </div>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }} title={item.owner_name || 'Sale phụ trách'}>
                             <Avatar name={item.owner_name} size={16} />
                             <span>{item.owner_name?.split(' ').pop() || 'Sale'}</span>
                            </div>
                         </div>
                         {isMobile && (
                           <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem' }}>
                             <button
                               className="btn outline sm"
                               style={{ width: '100%', height: '32px', fontSize: '0.75rem', padding: '0 8px', borderRadius: '8px', fontWeight: 700 }}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setStagePickerItem({ id: item.id, fromStageId: stage.id });
                               }}
                             >
                               Chuyển giai đoạn...
                             </button>
                           </div>
                         )}
                       </motion.div>
                     )})}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card-panel" style={{ flex: 1, overflow: 'auto', background: 'var(--color-surface)', padding: 0 }}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center" style={{ minHeight: 300 }}><Loader2 className="spin" size={32} /></div>
          ) : (
            <table className="table" style={{ width: '100%', minWidth: 800 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ width: 44, padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                    <CustomCheckbox checked={pagedItems.every(item => selected.has(item.id)) && pagedItems.length > 0} onChange={togglePageAll} />
                  </th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tên {pipelineView === 'deals' ? 'Cơ hội' : (pipelineView === 'contacts' ? 'Khách hàng' : 'Doanh nghiệp')}</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Giá trị</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Giai đoạn</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{pipelineView === 'deals' ? 'Tỉ lệ / Chốt' : 'Liên hệ'}</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map(item => {
                  const itemName = pipelineView === 'contacts' ? `${item.first_name || ''} ${item.last_name || ''}`.trim() : (pipelineView === 'companies' ? item.name : item.title);
                  const itemValue = Number(item.expected_revenue) || Number(item.value) || 0;
                  const stage = stages.find(s => s.id === item.stage_id);
                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => {
                        if (pipelineView === 'contacts') { setSelectedContact(item); setShowContactDrawer(true); }
                        else { setSelectedCompany(item); setShowCompanyDrawer(true); }
                      }}
                      className="table-row-hover"
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                    >
                      <td style={{ padding: '1rem' }} onClick={e => e.stopPropagation()}>
                        <CustomCheckbox checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                           <Avatar name={itemName} src={item.avatar_url} size={32} />
                          <div>
                            <p style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{itemName}</p>
                            {item.company_name && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.company_name}</p>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.875rem' }}>{FMT(Number(item.expected_revenue) || Number(item.value) || 0)}</span>
                        {pipelineView === 'deals' && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{item.probability || 50}% win</div>}
                        {pipelineView === 'contacts' && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{item.win_probability || 50}% win</div>}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, background: stage ? `${stage.color || 'var(--color-primary)'}15` : 'var(--color-bg)', color: stage ? stage.color || 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                          {stage?.name || 'Không xác định'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {item.phone && <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}><Phone size={12} className="text-light"/> {item.phone}</div>}
                        {item.email && <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12} className="text-light"/> {item.email}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          {/* Pagination Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '1rem', borderTop: '1px solid var(--color-border-light)', background: 'var(--color-bg-light)', width: '100%' }}>
            <Pagination total={total} page={page} pageSize={limit} onChange={setPage} />
          </div>
        </div>
      )}

      {showContactDrawer && (
        <CustomerProfileDrawer 
          isOpen={showContactDrawer}
          onClose={() => setShowContactDrawer(false)}
          contact={selectedContact}
          onUpdate={(updated) => { updateItemLocally(updated); fetchData(); }}
        />
      )}

      {showCompanyDrawer && (
        <CompanyDrawer
          isOpen={showCompanyDrawer}
          onClose={() => setShowCompanyDrawer(false)}
          entity={selectedCompany}
          onSave={() => fetchData()}
        />
      )}

      {showDealDrawer && (
        <DealDrawer
          isOpen={showDealDrawer}
          onClose={() => setShowDealDrawer(false)}
          deal={selectedDeal}
          onSave={() => fetchData()}
          stages={stages}
        />
      )}



      {/* Transition Modal */}
      <AnimatePresence>
        {transitionModal && transitionModal.isOpen && (
          <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 }} onClick={() => setTransitionModal(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-surface)', width: '100%', maxWidth: '400px', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: 'var(--shadow-2xl)' }}
            >
              {(() => {
                const fromIndex = stages.findIndex(s => s.id === transitionModal.fromStage);
                const toIndex = stages.findIndex(s => s.id === transitionModal.toStage);
                const skipped = (fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex + 1)
                  ? stages.slice(fromIndex + 1, toIndex).map(s => s.name)
                  : (fromIndex !== -1 && toIndex !== -1 && fromIndex > toIndex + 1)
                  ? stages.slice(toIndex + 1, fromIndex).map(s => s.name)
                  : [];
                return (
                  <>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cập nhật Pipeline</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                      Từ <strong>{stages.find(s => s.id === transitionModal.fromStage)?.name}</strong> 
                      {' '}➔{' '}
                      <strong style={{ color: stages.find(s => s.id === transitionModal.toStage)?.color }}>{stages.find(s => s.id === transitionModal.toStage)?.name}</strong>
                    </p>

                    {skipped.length > 0 && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '1rem',
                        marginBottom: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontWeight: 700, fontSize: '0.875rem' }}>
                          <AlertCircle size={16} /> Nhảy cóc giai đoạn!
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                          Bạn đang di chuyển qua nhiều giai đoạn. Bỏ qua các bước: <strong style={{ color: 'var(--color-text)' }}>{skipped.join(', ')}</strong>.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
              
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Ghi chú Audit Trail <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <textarea 
                  className="form-input" 
                  rows={3} 
                  placeholder="Ghi chú bắt buộc lý do chuyển..."
                  value={transitionModal.note}
                  onChange={e => setTransitionModal({ ...transitionModal, note: e.target.value })}
                  style={{ minHeight: '120px', padding: '12px 16px', lineHeight: 1.5, resize: 'vertical' }}
                  autoFocus
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn outline" onClick={() => setTransitionModal(null)}>Hủy</button>
                <button className="btn primary" onClick={handleConfirmTransition}>Lưu cập nhật</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Move Modal */}
      <AnimatePresence>
        {showBulkMove && (
          <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowBulkMove(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ background: 'var(--color-surface)', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-2xl)' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Chuyển {selected.size} thẻ sang...</h3>
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Chọn giai đoạn đích</label>
                <CustomSelect 
                  options={stages.map(s => ({ value: String(s.id), label: s.name }))} 
                  value={targetStageId} 
                  onChange={v => setTargetStageId(v as string)} 
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn outline" style={{ flex: 1 }} onClick={() => setShowBulkMove(false)}>Hủy</button>
                <button className="btn primary" style={{ flex: 1 }} onClick={bulkMove} disabled={!targetStageId}>Xác nhận chuyển</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stage Picker for Mobile Quick Move */}
      <AnimatePresence>
        {stagePickerItem && (
          <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 11000 }} onClick={() => setStagePickerItem(null)}>
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--color-surface)', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}
            >
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '1rem', textAlign: 'center' }}>Chọn giai đoạn mới</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {stages.filter(s => s.id !== stagePickerItem.fromStageId).map(s => (
                  <button
                    key={s.id}
                    className="btn outline"
                    style={{ width: '100%', justifyContent: 'flex-start', borderLeftWidth: '6px', borderLeftColor: s.color || 'var(--color-primary)' }}
                    onClick={() => {
                      setTransitionModal({
                        isOpen: true,
                        itemId: stagePickerItem.id,
                        fromStage: stagePickerItem.fromStageId,
                        toStage: s.id,
                        note: ''
                      });
                      setStagePickerItem(null);
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <button className="btn ghost" style={{ width: '100%', marginTop: '1rem', fontWeight: 700 }} onClick={() => setStagePickerItem(null)}>Đóng</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
