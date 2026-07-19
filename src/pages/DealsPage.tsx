import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pagination } from '../components/ui/Pagination';
import { Plus, GripVertical, Pencil, Trash2, Calendar, Target, DollarSign, MessageSquare, Building2, Loader2, Search, Filter, Users, User, CheckCircle2, Phone, Mail, LayoutGrid, List, Clock, Download, RefreshCw, X, AlertCircle, AlertTriangle, ShieldAlert, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import confetti from 'canvas-confetti';
import { useUIStore } from '../store/uiStore';
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import { CompanyDrawer } from './CompanyDrawer';
import { DealDrawer } from './DealDrawer';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
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
  const currentUser = useAuthStore.getState().user;
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
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && ['manager', 'admin', 'superadmin'].includes(currentUser.role)) {
      api.get('/teams').then(res => {
        setTeams(res.data.data || res.data || []);
      }).catch(() => {});
    }
  }, []);

  const getEffectiveTeamId = () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return null;
    if ((currentUser as any).team_id) return (currentUser as any).team_id;
    if (currentUser.role === 'manager') {
      const managedTeam = teams.find(t => Number(t.leader_id) === Number(currentUser.id));
      return managedTeam?.id || null;
    }
    return null;
  };

  const effectiveTeamId = useMemo(() => {
    return getEffectiveTeamId();
  }, [teams]);
  
  // Drawers
  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [showCompanyDrawer, setShowCompanyDrawer] = useState(false);
  const [showDealDrawer, setShowDealDrawer] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  
  const [dragging, setDragging] = useState<{ id: number, fromStage: number } | null>(null);
  const [transitionModal, setTransitionModal] = useState<{ 
    isOpen: boolean; 
    itemId: number; 
    toStage: number; 
    fromStage: number; 
    note: string;
    isCancellation?: boolean;
    hasRevenue?: 'yes' | 'no' | null;
  } | null>(null);
  const [isConfirmingTransition, setIsConfirmingTransition] = useState(false);
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
  const debouncedSearch = useDebounce(searchTerm.trim(), 300);
  const [dateFilterType, setDateFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const [projects, setProjects] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  
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
  const [limit, setLimit] = useState<number>(() => {
    return Number(localStorage.getItem('richland_deals_page_size')) || 20;
  });
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
        // Project Filter
        if (filterProject && String(item.project_id) !== String(filterProject)) return false;
        // Campaign Filter
        if (filterCampaign && String(item.campaign_id) !== String(filterCampaign)) return false;
        // Source Filter
        if (filterSource && String(item.source) !== String(filterSource)) return false;
        
        return true;
      });
    });
    return result;
  }, [items, debouncedSearch, dateFilterType, filterDateFrom, filterDateTo, filterAssignee, filterStage, filterProject, filterCampaign, filterSource, pipelineView]);

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
    const params = new URLSearchParams();
    params.set('type', pipelineView === 'contacts' ? 'contact' : (pipelineView === 'companies' ? 'company' : 'deal'));
    params.set('token', localStorage.getItem('token') || '');
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filterAssignee) params.set('owner_id', filterAssignee);
    if (filterStage) params.set('stage_id', filterStage);
    if (filterDateFrom) params.set('from', filterDateFrom);
    if (filterDateTo) params.set('to', filterDateTo);

    window.open(`${api.defaults.baseURL}/export?${params.toString()}`, '_blank');
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
      let list = r.data.data || [];
      const teamId = getEffectiveTeamId();
      if (currentUser?.role === 'manager' && teamId) {
        list = list.filter((u: any) => String(u.team_id) === String(teamId));
      }
      setAllUsers(list);
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

  const fetchProjects = async () => {
    try {
      const currentUser = useAuthStore.getState().user;
      const isRosterRestricted = ['sale', 'sales', 'manager', 'director'].includes(currentUser?.role || '');
      const bypassProj = isRosterRestricted ? '' : '?bypass_roster=1';
      const r = await api.get(`/projects${bypassProj}`);
      setProjects(r.data.data || []);
    } catch (e) {
      console.error("Failed to fetch projects", e);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const r = await api.get('/marketing-campaigns');
      setCampaigns(r.data.data?.items || r.data.data || []);
    } catch (e) {
      console.error("Failed to fetch campaigns", e);
    }
  };

  const fetchSources = async () => {
    try {
      const r = await api.get('api.php?action=get_unique_sources');
      if (r.data?.success) {
        setSources(r.data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch sources", e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = pipelineView === 'contacts' ? '/contacts' : (pipelineView === 'companies' ? '/companies' : '/deals');
      const params: any = {
        page: viewMode === 'kanban' ? 1 : page,
        limit: viewMode === 'kanban' ? 500 : limit,
        search: debouncedSearch,
        owner_id: filterAssignee,
        stage_id: filterStage,
        project_id: filterProject,
        campaign_id: filterCampaign,
        source: filterSource,
      };

      const teamId = getEffectiveTeamId();
      if (teamId) {
        params.team_id = teamId;
      }

      if (dateFilterType && (filterDateFrom || filterDateTo)) {
        params.from = filterDateFrom;
        params.to = filterDateTo;
      }

      const r = await api.get(endpoint, { params });
      let dataItems = r.data.data?.items || [];

      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'sale') {
        dataItems = dataItems.filter((c: any) => Number(c.owner_id) === Number(currentUser.id));
      } else if (currentUser?.role === 'manager') {
        const activeTeamId = getEffectiveTeamId();
        if (activeTeamId && allUsers.length > 0) {
          const teamMemberIds = allUsers.map((u: any) => u.id);
          if (!teamMemberIds.includes(currentUser.id)) {
            teamMemberIds.push(currentUser.id);
          }
          dataItems = dataItems.filter((c: any) => teamMemberIds.includes(Number(c.owner_id)));
        }
      }

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
    fetchProjects();
    fetchCampaigns();
    fetchSources();
    fetchStages();
  }, [pipelineView]);

  useEffect(() => {
    fetchUsers();
  }, [pipelineView, teams]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id') || urlParams.get('deal_id');
    if (targetId) {
      const did = Number(targetId);
      if (did) {
        api.get(`/deals/${did}`).then(res => {
          if (res.data.success && res.data.data) {
            const deal = res.data.data;
            const highlightNoteId = urlParams.get('highlight_note_id');
            if (highlightNoteId && deal.contact_id) {
              window.location.href = `/contacts?open_contact_id=${deal.contact_id}&highlight_note_id=${highlightNoteId}`;
              return;
            }
            setSelectedDeal(deal);
            setShowDealDrawer(true);
            
            // Clean URL parameters
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('id');
            newParams.delete('deal_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        }).catch(err => {
          console.error("Error loading deep link deal:", err);
        });
      }
    }
  }, [window.location.search]);

  useEffect(() => {
    if (stages.length > 0) fetchData();
  }, [stages, pipelineView, page, debouncedSearch, filterAssignee, filterStage, filterProject, filterCampaign, filterSource, filterDateFrom, filterDateTo, viewMode, allUsers.length, effectiveTeamId]);

  useEffect(() => {
    const handleRefresh = () => {
      if (stages.length > 0) {
        fetchData();
      }
    };
    window.addEventListener('lead-claimed', handleRefresh);
    window.addEventListener('lead-added', handleRefresh);
    window.addEventListener('contact-updated', handleRefresh);
    return () => {
      window.removeEventListener('lead-claimed', handleRefresh);
      window.removeEventListener('lead-added', handleRefresh);
      window.removeEventListener('contact-updated', handleRefresh);
    };
  }, [stages]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterAssignee, filterStage, filterProject, filterCampaign, filterSource, filterDateFrom, filterDateTo, pipelineView]);

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
    if (!updated) return;
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

  const openStageTransitionModal = (itemId: number, fromStage: number, toStage: number) => {
    const fromStageObj = stages.find(s => s.id === fromStage);
    const toStageObj = stages.find(s => s.id === toStage);
    const isFromDeposit = fromStageObj?.name?.toLowerCase()?.includes('cọc') || fromStageObj?.name?.toLowerCase()?.includes('deposit');
    const isToSuccess = toStageObj?.name?.toLowerCase()?.includes('hợp đồng') || toStageObj?.name?.toLowerCase()?.includes('won') || toStageObj?.name?.toLowerCase()?.includes('thành công') || toStageObj?.is_won;
    const isCancellation = isFromDeposit && !isToSuccess;

    const fromIdx = stages.findIndex(s => s.id === fromStage);
    const toIdx = stages.findIndex(s => s.id === toStage);
    const isBackward = fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx;

    if (isBackward && !isCancellation) {
      addToast("Không thể di chuyển ngược giai đoạn trên Pipeline.", "error");
      return;
    }

    const isForwardSkip = (fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx + 1);
    if (isForwardSkip) {
      addToast("Không được phép nhảy cóc giai đoạn. Tiến trình chuyển giai đoạn phải đi tuần tự từng bước.", "error");
      return;
    }

    setTransitionModal({
      isOpen: true,
      itemId,
      fromStage,
      toStage,
      note: '',
      isCancellation,
      hasRevenue: null
    });
  };

  const handleDrop = (toStage: number) => {
    if (!dragging || dragging.fromStage === toStage) return;
    openStageTransitionModal(dragging.id, dragging.fromStage, toStage);
    setDragging(null);
  };

  const handleConfirmTransition = async () => {
    if (!transitionModal || isConfirmingTransition) return;

    if (transitionModal.isCancellation) {
      if (!transitionModal.hasRevenue) {
        addToast('Vui lòng xác nhận trạng thái doanh thu thực tế.', 'warning');
        return;
      }
      if (transitionModal.hasRevenue === 'yes') {
        addToast('Không thể chuyển trạng thái. Quy định yêu cầu giữ nguyên Đặt cọc do đã có doanh thu.', 'error');
        return;
      }
    }

    if (!transitionModal.note.trim()) { addToast('Vui lòng nhập ghi chú bắt buộc (Audit Trail)', 'warning'); return; }

    try {
      setIsConfirmingTransition(true);
      const endpoint = pipelineView === 'contacts' ? `/contacts/${transitionModal.itemId}/stage` : (pipelineView === 'companies' ? `/companies/${transitionModal.itemId}/stage` : `/deals/${transitionModal.itemId}/stage`);
      await api.patch(endpoint, { 
        stage_id: transitionModal.toStage,
        note: transitionModal.isCancellation 
          ? `[Bể cọc - Không doanh thu] ${transitionModal.note}`
          : transitionModal.note
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
    } catch (err: any) { 
      addToast(err.response?.data?.message || 'Lỗi khi di chuyển thẻ', 'error'); 
    } finally {
      setIsConfirmingTransition(false);
      setTransitionModal(null);
    }
  };

  const handleSaveDeal = async (formData: any) => {
    try {
      if (selectedDeal) {
        await api.put(`/deals/${selectedDeal.id}`, formData);
        addToast('Đã cập nhật cơ hội thành công', 'success');
      }
      setShowDealDrawer(false);
      fetchData();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu cơ hội', 'error');
    }
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

  const hasActiveFilters = !!(
    searchTerm.trim() ||
    filterAssignee ||
    filterStage ||
    filterProject ||
    filterCampaign ||
    filterSource ||
    dateFilterType ||
    filterDateFrom ||
    filterDateTo
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterAssignee('');
    setFilterStage('');
    setFilterProject('');
    setFilterCampaign('');
    setFilterSource('');
    setDateFilterType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
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

        {/* Desktop Pipeline Tabs Switcher (Moved to Left) */}
        <div className="hide-on-mobile" style={{ 
          display: 'flex', 
          background: 'var(--color-border-light)', 
          border: '1px solid var(--color-border)',
          padding: '2px', 
          borderRadius: '8px', 
          gap: '2px',
          height: '38px', 
          marginRight: '0.5rem', 
          position: 'relative',
          width: 'fit-content',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          {/* Sliding Pill Background Indicator */}
          <div style={{
            position: 'absolute',
            top: '2px',
            bottom: '2px',
            width: '140px',
            borderRadius: '6px',
            background: 'var(--color-surface)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: `translateX(${
              pipelineView === 'contacts' ? '0px' : '142px'
            })`,
            zIndex: 1
          }} />

          {[
            { id: 'contacts', label: 'Khách hàng', icon: <Users size={14} /> },
            { id: 'companies', label: 'Doanh nghiệp', icon: <Building2 size={14} /> }
          ].map(tab => {
            const isSelected = pipelineView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setPipelineView(tab.id as any)}
                style={{
                  width: '140px',
                  height: '32px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isSelected ? 'var(--color-text)' : 'var(--color-text-light)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  position: 'relative',
                  zIndex: 2,
                  transition: 'color 0.25s ease',
                  outline: 'none'
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: isMobile ? '100%' : 'auto',
          justifyContent: isMobile ? 'space-between' : 'flex-end',
          marginTop: isMobile ? '0.75rem' : 0
        }}>
          {/* Mobile Pipeline Selector Dropdown */}
          <div className="mobile-only" style={{ width: 145 }}>
            <CustomSelect
              value={pipelineView}
              onChange={val => setPipelineView(val as any)}
              options={[
                { value: 'contacts', label: 'Khách hàng' },
                { value: 'companies', label: 'Doanh nghiệp' }
              ]}
            />
          </div>

          {/* Kanban vs List Toggle (Moved to Right) */}
          <div style={{ 
            display: 'flex', 
            background: 'var(--color-border-light)', 
            border: '1px solid var(--color-border)',
            padding: '2px', 
            borderRadius: '8px', 
            gap: '2px',
            height: '38px', 
            position: 'relative',
            width: 'fit-content',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}>
            {/* Sliding Pill Background Indicator */}
            <div style={{
              position: 'absolute',
              top: '2px',
              bottom: '2px',
              width: '32px',
              borderRadius: '6px',
              background: 'var(--color-surface)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: `translateX(${viewMode === 'kanban' ? '0px' : '34px'})`,
              zIndex: 1
            }} />

            {[
              { id: 'kanban', icon: <LayoutGrid size={15} />, title: "Dạng bảng (Kanban)" },
              { id: 'list', icon: <List size={15} />, title: "Dạng danh sách" }
            ].map(tab => {
              const isSelected = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id as any)}
                  title={tab.title}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: isSelected ? 'var(--color-text)' : 'var(--color-text-light)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 2,
                    transition: 'color 0.25s ease',
                    outline: 'none'
                  }}
                >
                  {tab.icon}
                </button>
              );
            })}
          </div>

          {!isMobile && currentUser?.role !== 'viewer' && currentUser?.role !== 'sale' && (
            <button 
              onClick={() => setShowImportExport(true)} 
              title="Nhập/Xuất"
              style={{ 
                height: '38px', 
                fontSize: '0.8rem', 
                padding: '0 12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                outline: 'none',
                boxShadow: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Download size={14} />
              <span className="hide-on-mobile" style={{ marginLeft: '0.25rem' }}> Nhập/Xuất</span>
            </button>
          )}
        </div>

      </div>

      <ImportExportModal 
        isOpen={showImportExport} 
        onClose={() => setShowImportExport(false)} 
        entityName={pipelineView === 'deals' ? 'Cơ hội' : (pipelineView === 'contacts' ? 'Liên hệ' : 'Công ty')}
        onExport={() => {
            const type = pipelineView === 'deals' ? 'deal' : (pipelineView === 'contacts' ? 'contact' : 'company');
            const params = new URLSearchParams();
            params.set('type', type);
            params.set('token', localStorage.getItem('token') || '');
            if (debouncedSearch) params.set('search', debouncedSearch);
            if (filterAssignee) params.set('owner_id', filterAssignee);
            if (filterStage) params.set('stage_id', filterStage);
            if (filterDateFrom) params.set('from', filterDateFrom);
            if (filterDateTo) params.set('to', filterDateTo);
            window.open(`${api.defaults.baseURL}/export?${params.toString()}`, '_blank');
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
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: isMobile ? 'nowrap' : 'wrap', width: '100%' }}>
                <div className="filter-search" style={{ width: isMobile ? 'auto' : '400px', flex: isMobile ? 1 : undefined, position: 'relative', height: '38px', borderRadius: '8px', border: '1px solid var(--color-border)', boxSizing: 'border-box', paddingRight: '2.5rem' }}>
                  <Search size={14} style={{ color:'var(--color-text-muted)', marginLeft: '4px' }}/>
                  <input 
                    placeholder="Tìm tên, email, điện thoại..." 
                    value={searchTerm} 
                    onChange={e => { setSearchTerm(e.target.value); setPage(1); }} 
                    style={{ paddingRight: '0.5rem', height: '100%' }} 
                  />
                  <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                    <AnimatePresence>
                      {searchTerm && (
                        <motion.button 
                          initial={{ opacity: 0, scale: 0.8 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          className="btn-icon-bare" 
                          onClick={() => setSearchTerm('')} 
                          style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'transparent' }}
                          title="Xóa tìm kiếm"
                        >
                          <X size={14} style={{ color: 'var(--color-text-muted)' }}/>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <button 
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  style={{
                    height: isMobile ? '36px' : '38px',
                    padding: '0 0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    background: showFilterPanel ? 'var(--color-bg-light)' : 'var(--color-surface)',
                    color: showFilterPanel ? 'var(--color-primary)' : 'var(--color-text)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  title="Bộ lọc nâng cao"
                >
                  <Filter size={15} />
                  <span>Bộ lọc</span>
                </button>

                {hasActiveFilters && (
                  <button 
                    onClick={handleClearFilters}
                    style={{
                      height: isMobile ? '36px' : '38px',
                      padding: '0 0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      borderRadius: '8px',
                      background: 'rgba(220, 38, 38, 0.05)',
                      color: '#dc2626',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    title="Xóa tất cả bộ lọc đang chọn"
                  >
                    <X size={15} />
                    <span>Xóa bộ lọc</span>
                  </button>
                )}
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
                   {/* Dự án */}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Dự án</label>
                      <CustomSelect 
                        options={[{value: '', label: 'Tất cả dự án'}, ...projects.map(p => ({value: String(p.id), label: p.name}))]} 
                        value={filterProject} 
                        onChange={v => setFilterProject(v as string)} 
                        searchable
                      />
                   </div>
                   {/* Chiến dịch */}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Chiến dịch</label>
                      <CustomSelect 
                        options={[{value: '', label: 'Tất cả chiến dịch'}, ...campaigns.map(c => ({value: String(c.id), label: c.name}))]} 
                        value={filterCampaign} 
                        onChange={v => setFilterCampaign(v as string)} 
                        searchable
                      />
                   </div>
                   {/* Nguồn */}
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Nguồn dữ liệu</label>
                      <CustomSelect 
                        options={[{value: '', label: 'Tất cả nguồn'}, ...sources.map(s => ({value: String(s), label: String(s)}))]} 
                        value={filterSource} 
                        onChange={v => setFilterSource(v as string)} 
                        searchable
                      />
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

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {viewMode === 'list' && (
        <div 
          className="custom-scrollbar" 
          style={{ 
            display: 'flex', 
            gap: '0.25rem', 
            overflowX: 'auto', 
            padding: '4px 6px 12px 6px', 
            alignItems: 'center',
            background: 'var(--color-bg-light)',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            marginBottom: '1rem'
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', paddingLeft: '10px', paddingRight: '6px' }}>Giai đoạn:</span>
          
          <button
            onClick={() => setActiveStageFilter('all')}
            style={{
              padding: '6px 14px', 
              borderRadius: '6px', 
              fontSize: '0.8125rem', 
              fontWeight: 700, 
              cursor: 'pointer', 
              whiteSpace: 'nowrap', 
              transition: 'all 0.2s',
              border: activeStageFilter === 'all' ? '1px solid var(--color-text)' : '1px solid var(--color-border)',
              background: activeStageFilter === 'all' ? 'var(--color-text)' : 'var(--color-surface)',
              color: activeStageFilter === 'all' ? 'var(--color-surface)' : 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activeStageFilter === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            Tất cả ({Object.values(filteredItems).flat().length})
          </button>

          <div style={{ width: '1px', height: '22px', background: 'var(--color-border)', margin: '0 0.5rem', flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap' }}>
            {stages.map((stage, idx) => {
              const count = (filteredItems[stage.id] || []).length;
              const isActive = activeStageFilter === stage.id;
              return (
                <React.Fragment key={stage.id}>
                  {idx > 0 && (
                    <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', opacity: 0.6, flexShrink: 0 }} />
                  )}
                  <button
                    onClick={() => setActiveStageFilter(stage.id)}
                    style={{
                      padding: '6px 14px', 
                      borderRadius: '6px', 
                      fontSize: '0.8125rem', 
                      fontWeight: 700, 
                      cursor: 'pointer', 
                      whiteSpace: 'nowrap', 
                      transition: 'all 0.2s',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      opacity: count === 0 && !isActive ? 0.55 : 1,
                      border: `1px solid ${isActive ? stage.color || 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: isActive ? `${stage.color || 'var(--color-primary)'}12` : 'var(--color-surface)',
                      color: isActive ? stage.color || 'var(--color-text)' : 'var(--color-text-light)',
                      boxShadow: isActive ? `0 2px 4px ${stage.color || 'var(--color-primary)'}15` : 'none'
                    }}
                  >
                    <span 
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: stage.color || 'var(--color-primary)',
                        display: 'inline-block',
                        flexShrink: 0
                      }} 
                    />
                    {stage.name}
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        color: isActive ? 'inherit' : 'var(--color-text-muted)',
                        background: isActive ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.04)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        marginLeft: '2px'
                      }}
                    >
                      {count}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
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
        <div className="card custom-scrollbar" style={{ 
          display: 'flex', 
          gap: isMobile ? '0.75rem' : '1.25rem', 
          overflowX: 'auto', 
          padding: isMobile ? '0.75rem' : '1.5rem', 
          paddingBottom: '2rem', 
          height: 'calc(100vh - 280px)',
          minHeight: '520px',
          flex: 1, 
          alignItems: 'stretch', 
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
                <div key={i} style={{ minWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : 320, flexShrink: 0, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', overflow: 'hidden', height: '100%' }}>
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
                  display: 'flex', flexDirection: 'column', maxHeight: '100%', height: '100%',
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
                      const isItemOwner = Number(currentUser?.id) === Number(item.owner_id || item.created_by);
                      const isPrivileged = currentUser?.role && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant'].includes(currentUser.role);
                      const canDrag = (isItemOwner || isPrivileged) && currentUser?.role !== 'viewer';
                      return (
                      <motion.div key={item.id}
                        draggable={canDrag}
                        onDragStart={() => canDrag && setDragging({ id: item.id, fromStage: stage.id })}
                        onDragEnd={() => setDragging(null)}
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} layout
                        style={{ 
                          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '0.875rem 1rem', 
                          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-light)', 
                          cursor: canDrag ? 'grab' : 'default', userSelect: 'none', position: 'relative'
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
                             <Avatar name={item.owner_name} src={item.owner_avatar} size={16} />
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
            <Pagination
              total={total}
              page={page}
              pageSize={limit}
              onChange={setPage}
              showSizeChanger
              onPageSizeChange={size => {
                setLimit(size);
                localStorage.setItem('richland_deals_page_size', String(size));
                setPage(1);
              }}
            />
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
          onSave={handleSaveDeal}
          stages={stages}
        />
      )}

      {/* Transition Modal */}
      {createPortal(
        <AnimatePresence>
          {transitionModal && transitionModal.isOpen && (
            <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 }} onClick={() => setTransitionModal(null)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--color-surface)', width: '90%', maxWidth: transitionModal.isCancellation ? '580px' : '520px', borderRadius: '12px', padding: '1.75rem', boxShadow: 'var(--shadow-2xl)', border: '1px solid var(--color-border)' }}
              >
                {transitionModal.isCancellation ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', color: 'var(--color-danger)' }}>
                      <AlertTriangle size={22} />
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Xác Nhận Nghiệp Vụ Bể Cọc</h3>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                      Bạn đang di chuyển Deal này ra khỏi giai đoạn <strong>{stages.find(s => s.id === transitionModal.fromStage)?.name}</strong> (Báo bể cọc). 
                      Vui lòng xác nhận tình trạng doanh thu thực tế của Deal:
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
                      {/* Option 1: No Revenue */}
                      <button
                        type="button"
                        onClick={() => setTransitionModal({ ...transitionModal, hasRevenue: 'no' })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '12px 16px',
                          border: `1.5px solid ${transitionModal.hasRevenue === 'no' ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                          background: transitionModal.hasRevenue === 'no' ? 'var(--color-primary-light)' : 'transparent',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          width: '100%'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {transitionModal.hasRevenue === 'no' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }} />}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: transitionModal.hasRevenue === 'no' ? 'var(--color-primary)' : 'var(--color-text)' }}>Chưa phát sinh doanh thu</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '24px' }}>
                          Khách hàng hủy cọc trước khi công ty thực thu bất kỳ dòng tiền/phí môi giới nào. Lead sẽ bị hạ cấp và khởi động lại bảo mật.
                        </span>
                      </button>

                      {/* Option 2: Has Revenue */}
                      <button
                        type="button"
                        onClick={() => setTransitionModal({ ...transitionModal, hasRevenue: 'yes' })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '12px 16px',
                          border: `1.5px solid ${transitionModal.hasRevenue === 'yes' ? 'var(--color-danger)' : 'var(--color-border-light)'}`,
                          background: transitionModal.hasRevenue === 'yes' ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          width: '100%'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--color-danger)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {transitionModal.hasRevenue === 'yes' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)' }} />}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: transitionModal.hasRevenue === 'yes' ? 'var(--color-danger)' : 'var(--color-text)' }}>Đã có doanh thu (Đóng đợt 1)</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '24px' }}>
                          Công ty đã thu phí đợt 1 thành công. Theo quy định, khách hàng phải được giữ nguyên trạng thái Đặt Cọc.
                        </span>
                      </button>
                    </div>

                    {transitionModal.hasRevenue === 'yes' && (
                      <div className="vibrate-alert" style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1.5px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-start'
                      }}>
                        <ShieldAlert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-danger)' }}>Hành động bị chặn!</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', lineHeight: 1.35 }}>
                            Không cho phép hạ cấp trạng thái. Do giao dịch đã đóng đợt 1, hệ thống bắt buộc giữ nguyên Deal ở cột Đặt Cọc.
                          </span>
                        </div>
                      </div>
                    )}

                    {transitionModal.hasRevenue === 'no' && (
                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">Lý do bể cọc (Audit Trail) <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <textarea 
                          className="form-input" 
                          rows={3} 
                          placeholder="Nhập lý do chi tiết để lưu lịch sử kiểm tra..."
                          value={transitionModal.note}
                          onChange={e => setTransitionModal({ ...transitionModal, note: e.target.value })}
                          style={{ minHeight: '90px', padding: '10px 14px', lineHeight: 1.4, resize: 'vertical' }}
                          autoFocus
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
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
                  </>
                )}
                
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button className="btn outline" onClick={() => setTransitionModal(null)} disabled={isConfirmingTransition}>Hủy</button>
                  <button 
                    className="btn primary" 
                    onClick={handleConfirmTransition}
                    disabled={
                      isConfirmingTransition ||
                      (transitionModal.isCancellation 
                        ? (transitionModal.hasRevenue === 'yes' || !transitionModal.hasRevenue || !transitionModal.note.trim())
                        : !transitionModal.note.trim())
                    }
                  >
                    {isConfirmingTransition ? 'Đang lưu...' : 'Lưu cập nhật'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Bulk Move Modal */}
      {createPortal(
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
        </AnimatePresence>,
        document.body
      )}

      {/* Stage Picker for Mobile Quick Move */}
      {createPortal(
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
                        openStageTransitionModal(stagePickerItem.id, stagePickerItem.fromStageId, s.id);
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
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
};
