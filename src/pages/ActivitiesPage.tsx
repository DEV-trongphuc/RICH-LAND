import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle2, Clock, Phone, Mail, Users, Calendar, AlignLeft, X, Loader2, Pencil, Trash2, RefreshCw, Link2, Search, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { useUIStore } from '../store/uiStore';
import { useNavigate } from 'react-router-dom';
import { Pagination } from '../components/ui/Pagination';
import api from '../api/axios';
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import { DEV_MODE } from '../config/env';
import { useDebounce } from '../hooks/useDebounce';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CalendarView } from '../components/CalendarView';
import { LayoutList } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';

const PAGE_SIZE = 50;
import { useMockStore, getFilteredMockState } from '../store/mockStore';

const MOCK_ACTIVITIES: any[] = [];

const TYPES = ['call', 'email', 'meeting', 'task', 'note'];
const T_LABEL: Record<string, string> = { call: 'Cuộc gọi', email: 'Email', meeting: 'Cuộc họp', task: 'Task', note: 'Ghi chú' };
const T_ICON: Record<string, React.ReactNode> = {
  call: <Phone size={14} />, email: <Mail size={14} />, meeting: <Users size={14} />,
  task: <CheckCircle2 size={14} />, note: <AlignLeft size={14} />
};
const T_COLOR: Record<string, string> = { call: '#3b82f6', email: '#BD1D2D', meeting: '#10b981', task: '#f59e0b', note: '#6b7280' };

const EMPTY = { type: 'call', subject: '', status: 'planned', priority: 'medium', due_date: '', related_type: '', related_id: '' };

const fmtDate = (d: string | null) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const now = new Date();
  const diffMs = dt.getTime() - now.getTime();
  const diffH = Math.round(diffMs / 3600000);
  if (Math.abs(diffH) < 1) return 'Trong giờ này';
  if (diffH < 0 && diffH > -24) return `${Math.abs(diffH)}h trước`;
  if (diffH > 0 && diffH < 24) return `Còn ${diffH}h`;
  return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const ActivitiesPage: React.FC = () => {
  const { addToast, showConfirm } = useUIStore();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [profileContact, setProfileContact] = useState<any>(null);

  const openContactDrawer = async (contactId: number) => {
    try {
      const res = await api.get(`/contacts/${contactId}`);
      if (res.data.success || res.data) {
        setProfileContact(res.data.data || res.data);
      }
    } catch (err) {
      console.error("Lỗi khi tải thông tin khách hàng:", err);
    }
  };

  // Related entities for dropdown
  const [contacts, setContacts] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    if (showModal) {
      if (DEV_MODE) {
        const s = getFilteredMockState();
        setContacts(s.contacts || []);
        setDeals(s.deals || []);
        setCompanies(s.companies || []);
      } else {
        api.get('/contacts', { params: { limit: 1000 } }).then(r => setContacts(r.data.data?.items || [])).catch(() => {});
        api.get('/deals', { params: { limit: 1000 } }).then(r => setDeals(r.data.data?.items || r.data.data || [])).catch(() => {});
        api.get('/companies', { params: { limit: 1000 } }).then(r => setCompanies(r.data.data?.items || [])).catch(() => {});
      }
    }
  }, [showModal]);

  const getRelatedOptions = () => {
    if (form.related_type === 'contact') {
      return contacts.map(c => ({ value: c.id, label: c.name, sublabel: c.phone || c.email, avatar: c.avatar }));
    }
    if (form.related_type === 'deal') {
      return deals.map(d => ({ value: d.id, label: d.title, sublabel: d.value ? `${(d.value || 0).toLocaleString()} đ` : '' }));
    }
    if (form.related_type === 'company') {
      return companies.map(c => ({ value: c.id, label: c.name, sublabel: c.industry }));
    }
    return [];
  };

  const fetchActivities = useCallback(async () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      let list = [...state.activities];
      
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        list = list.filter(a => a.subject.toLowerCase().includes(s) || a.notes?.toLowerCase().includes(s));
      }
      
      if (filterType) list = list.filter(a => a.type === filterType);
      if (filterStatus) list = list.filter(a => a.status === filterStatus);
      
      setItems(list);
      setTotal(list.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = { page, limit: PAGE_SIZE, search: debouncedSearch };
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      
      const r = await api.get('/activities', { params });
      const data = r.data.data;
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, debouncedSearch, page]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal && !saving) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showModal, saving]);

  const openCreate = () => { setEditItem(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (a: any) => { setEditItem(a); setForm({ ...a, due_date: a.due_date ? a.due_date.slice(0, 16) : '' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.subject.trim()) { addToast('Nhập tiêu đề hoạt động', 'error'); return; }
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/activities/${editItem.id}`, form);
        addToast('Đã cập nhật hoạt động', 'success');
      } else {
        await api.post('/activities', form);
        addToast('Đã thêm hoạt động', 'success');
      }
      setShowModal(false);
      fetchActivities();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu hoạt động', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (item: any) => {
    const newStatus = item.status === 'done' ? 'planned' : 'done';
    try {
      await api.put(`/activities/${item.id}`, { status: newStatus, done_at: newStatus === 'done' ? new Date().toISOString() : null });
      setItems(prev => prev.map(a => a.id === item.id ? { ...a, status: newStatus } : a));
    } catch (e: any) {
      addToast('Lỗi khi cập nhật trạng thái', 'error');
    }
  };

  const { closeConfirm } = useUIStore();
  const handleDelete = async (actItem: any) => {
    showConfirm({
      title: 'Xóa hoạt động?',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn "${actItem.subject}"?`,
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/activities/${actItem.id}`);
          setItems(prev => prev.filter(a => a.id !== actItem.id));
          addToast('Đã xóa hoạt động thành công', 'success');
        } catch (e: any) {
          addToast('Lỗi khi xóa hoạt động (Demo Mode)', 'error');
          setItems(prev => prev.filter(a => a.id !== actItem.id));
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const navigateToRelated = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.related_type || !item.related_id) return;
    if (item.related_type === 'contact') {
      openContactDrawer(Number(item.related_id));
    } else {
      const paths: Record<string, string> = { company: '/companies', deal: '/deals' };
      if (paths[item.related_type]) navigate(paths[item.related_type]);
    }
  };

  const doneCount = items.filter(a => a.status === 'done').length;
  const counts = TYPES.reduce((acc, t) => ({ ...acc, [t]: items.filter(a => a.type === t).length }), {} as Record<string, number>);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hoạt động & Lịch</h1>
          <p className="page-subtitle">{loading ? '...' : `${doneCount}/${total} đã hoàn thành`}</p>
        </div>
        <div className="flex gap-2">
          <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '4px', marginRight: '0.5rem', height: 44 }}>
            <button 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, background: viewMode === 'list' ? 'var(--color-primary-light)' : 'transparent', color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)', transition: 'all 0.2s', border: 'none', cursor: 'pointer', height: 36 }}
              onClick={() => setViewMode('list')}
            >
              <LayoutList size={16} /> Danh sách
            </button>
            <button 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, background: viewMode === 'calendar' ? 'var(--color-primary-light)' : 'transparent', color: viewMode === 'calendar' ? 'var(--color-primary)' : 'var(--color-text-muted)', transition: 'all 0.2s', border: 'none', cursor: 'pointer', height: 36 }}
              onClick={() => setViewMode('calendar')}
            >
              <Calendar size={16} /> Lịch biểu
            </button>
          </div>
          <button className="btn-icon" onClick={fetchActivities} title="Làm mới"><RefreshCw size={18} /></button>
          <button className="btn primary" onClick={openCreate}><Plus size={16} /> Thêm hoạt động</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="filter-search" style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={14} style={{ color:'var(--color-text-muted)' }}/>
          <input placeholder="Tìm nội dung hoạt động..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingRight: '2rem' }} />
          <AnimatePresence>
            {search && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="btn-icon-bare" 
                onClick={() => setSearch('')} 
                style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', padding: 4 }}
                title="Xóa tìm kiếm"
              >
                <X size={14} style={{ color: 'var(--color-text-muted)' }}/>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Quick filter chips */}
        <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setFilterType(filterType === t ? '' : t)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: filterType === t ? T_COLOR[t] : 'var(--color-surface)', color: filterType === t ? 'white' : 'var(--color-text)', border: `1px solid ${filterType === t ? T_COLOR[t] : 'var(--color-border)'}`, borderRadius: 'var(--radius-full)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s', cursor: 'pointer' }}>
              <span style={{ color: filterType === t ? 'white' : T_COLOR[t] }}>{T_ICON[t]}</span>
              {T_LABEL[t]} <span style={{ opacity: 0.75 }}>({counts[t] || 0})</span>
            </button>
          ))}
          <button onClick={() => setFilterStatus(filterStatus === 'done' ? '' : 'done')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: filterStatus === 'done' ? 'var(--color-success)' : 'var(--color-surface)', color: filterStatus === 'done' ? 'white' : 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <CheckCircle2 size={14} /> Đã xong
          </button>
        </div>
      </div>

      {/* Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      )}

      {/* Reminders Section */}
      <AnimatePresence>
        {!loading && items.some(a => a.status === 'planned' && a.due_date && new Date(a.due_date).toDateString() === new Date().toDateString()) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: '1.25rem', overflow: 'hidden' }}
          >
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.05), rgba(189, 29, 45, 0.05))', border: '1px solid var(--color-primary-light)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={18} fill="white" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>Tiêu điểm hôm nay</h3>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '4px' }}>
                {items.filter(a => a.status === 'planned' && a.due_date && new Date(a.due_date).toDateString() === new Date().toDateString()).map(rem => (
                  <motion.div 
                    key={rem.id} 
                    whileHover={{ y: -3, boxShadow: 'var(--shadow-md)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openEdit(rem)}
                    style={{ minWidth: 220, padding: '0.875rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ color: T_COLOR[rem.type] }}>{T_ICON[rem.type]}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{new Date(rem.due_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>{rem.subject}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                       <Avatar name={rem.user_name} size="sm" />
                       <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>Phụ trách: {rem.user_name?.split(' ').pop()}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activities list or Calendar */}
      {!loading && (
        <div style={{ height: viewMode === 'calendar' ? 'calc(100vh - 280px)' : 'auto' }}>
          {viewMode === 'calendar' ? (
            <CalendarView 
              onEventClick={openEdit} 
              onDateClick={(dateStr) => {
                setEditItem(null);
                setForm({ ...EMPTY, due_date: `${dateStr}T09:00` });
                setShowModal(true);
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {(() => {
                const filtered = items.filter(act => !search || act.subject.toLowerCase().includes(search.toLowerCase()));
                if (filtered.length === 0) return (
                  <div className="empty-state card">
                    <Calendar size={40} />
                    <h3>Không có hoạt động</h3>
                    <p>Thêm hoạt động mới để bắt đầu theo dõi công việc</p>
                    <button className="btn primary" style={{ marginTop: '1rem' }} onClick={openCreate}><Plus size={16} /> Thêm hoạt động</button>
                  </div>
                );

                const now = new Date();
                
                // Deduplicate logic for Overdue items if they are identical
                const overdueItems = filtered.filter(a => a.status === 'planned' && a.due_date && new Date(a.due_date) < now);
                const dedupedOverdue = overdueItems.reduce((acc: any[], curr) => {
                  const isDuplicate = acc.find(item => 
                    item.subject === curr.subject && 
                    item.type === curr.type && 
                    new Date(item.due_date).getTime() === new Date(curr.due_date).getTime()
                  );
                  if (!isDuplicate) acc.push(curr);
                  return acc;
                }, []);

                const groups: Record<string, any[]> = {
                  'Quá hạn': dedupedOverdue,
                  'Hôm nay': filtered.filter(a => a.status === 'planned' && a.due_date && new Date(a.due_date).toDateString() === now.toDateString()),
                  'Sắp tới': filtered.filter(a => a.status === 'planned' && (!a.due_date || (new Date(a.due_date) > now && new Date(a.due_date).toDateString() !== now.toDateString()))),
                  'Đã hoàn thành': filtered.filter(a => a.status === 'done'),
                };

                return Object.entries(groups).map(([label, groupItems]) => {
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: label === 'Quá hạn' ? 'var(--color-danger)' : 'var(--color-text-muted)', letterSpacing: '0.05em' }}>{label}</h4>
                        <div style={{ flex: 1, height: 1, background: 'var(--color-border-light)' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{groupItems.length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        <AnimatePresence>
                          {groupItems.map(act => (
                             <motion.div key={act.id} className="card hover-lift"
                               initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} layout
                               style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `4px solid ${act.status === 'done' ? 'var(--color-success)' : T_COLOR[act.type]}`, borderRadius: 'var(--radius-lg)' }}>
                              
                              <div style={{ width: 36, height: 36, borderRadius: '10px', background: T_COLOR[act.type] + '12', color: T_COLOR[act.type], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {T_ICON[act.type]}
                              </div>

                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <p style={{ fontWeight: 700, fontSize: '0.9rem', textDecoration: act.status === 'done' ? 'line-through' : 'none', color: act.status === 'done' ? 'var(--color-text-muted)' : 'var(--color-text)', margin: 0 }}>
                                    {act.subject}
                                  </p>
                                  {act.status !== 'done' && new Date(act.due_date) < now && (
                                    <span className="badge danger sm" style={{ fontSize: '0.65rem', padding: '1px 6px', fontWeight: 700 }}>QUÁ HẠN</span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Avatar name={act.user_name || 'Bạn'} size="sm" />
                                    <span style={{ fontWeight: 500 }}>{act.user_name || 'Bạn'}</span>
                                  </span>
                                  {act.due_date && (
                                    <span style={{ fontSize: '0.75rem', color: new Date(act.due_date) < now && act.status !== 'done' ? 'var(--color-danger)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                      <Clock size={12} />
                                      {fmtDate(act.due_date)}
                                    </span>
                                  )}
                                  <span className={`badge ${act.priority === 'high' ? 'danger' : act.priority === 'medium' ? 'warning' : 'info'}`} style={{ fontSize: '0.65rem', fontWeight: 600 }}>
                                    {act.priority === 'high' ? 'Quan trọng' : act.priority === 'medium' ? 'Bình thường' : 'Thấp'}
                                  </span>
                                  {act.related_type && (
                                    <button onClick={e => navigateToRelated(act, e)}
                                      style={{ fontSize: '0.75rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                                      <Link2 size={12} />
                                      {act.related_type === 'contact' ? (act.contact_name || act.contact_id) : 
                                       act.related_type === 'company' ? (act.company_name || act.company_id) : 
                                       act.related_type === 'deal' ? (act.deal_name || act.deal_id) : act.related_id}
                                    </button>
                                  )}
                                </div>
                                {act.body && (
                                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '600px' }}>
                                    {act.body}
                                  </p>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                <button onClick={() => toggleDone(act)}
                                  title={act.status === 'done' ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
                                  style={{ width: 28, height: 28, borderRadius: '8px', border: `1.5px solid ${act.status === 'done' ? 'var(--color-success)' : 'var(--color-border)'}`, background: act.status === 'done' ? 'var(--color-success-light)' : 'transparent', color: act.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                                  <CheckCircle2 size={15} />
                                </button>
                                <button className="btn ghost sm" onClick={() => openEdit(act)} style={{ padding: '6px' }}><Pencil size={13} /></button>
                                <button className="btn ghost sm" style={{ color: 'var(--color-danger)', padding: '6px' }} onClick={() => handleDelete(act)}><Trash2 size={13} /></button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="card" style={{ marginTop: '0.5rem' }}>
          <Pagination total={total} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}

      {/* Add/Edit Modal */}
      <CustomModal
        isOpen={showModal}
        onClose={() => !saving && setShowModal(false)}
        title={editItem ? 'Sửa hoạt động' : 'Thêm hoạt động'}
        width={520}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Type selector */}
          <div className="form-group">
            <label className="form-label">Loại hoạt động</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {TYPES.map(t => (
                <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                  style={{ padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)', border: `2px solid ${form.type === t ? T_COLOR[t] : 'var(--color-border)'}`, background: form.type === t ? T_COLOR[t] + '15' : 'transparent', color: form.type === t ? T_COLOR[t] : 'var(--color-text-light)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {T_ICON[t]} {T_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tiêu đề *</label>
            <input className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Nội dung hoạt động..." autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Thời gian</label>
              <input className="form-input" type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Ưu tiên</label>
              <CustomSelect 
                options={[
                  { value: 'low', label: 'Thấp' },
                  { value: 'medium', label: 'Trung bình' },
                  { value: 'high', label: 'Cao' }
                ]} 
                value={form.priority} 
                onChange={val => setForm({ ...form, priority: val.toString() })} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Liên kết đến</label>
              <CustomSelect 
                options={[
                  { value: '', label: 'Không có' },
                  { value: 'contact', label: 'Khách hàng' },
                  { value: 'deal', label: 'Deal' },
                  { value: 'company', label: 'Công ty' }
                ]} 
                value={form.related_type} 
                onChange={val => setForm({ ...form, related_type: val.toString(), related_id: '' })} 
              />
            </div>
            {form.related_type && (
              <div className="form-group">
                <label className="form-label">Chọn {form.related_type === 'contact' ? 'Khách hàng' : form.related_type === 'deal' ? 'Deal' : 'Công ty'}</label>
                <CustomSelect 
                  options={getRelatedOptions()} 
                  value={form.related_id} 
                  onChange={val => setForm({ ...form, related_id: val.toString() })} 
                  placeholder="Gõ để tìm kiếm..."
                  searchable={true}
                  showAvatars={form.related_type === 'contact'}
                />
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn secondary" onClick={() => setShowModal(false)} disabled={saving}>Hủy</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="spin" />}{editItem ? 'Lưu' : 'Thêm'}
          </button>
        </div>
      </CustomModal>

      <CustomerProfileDrawer
        isOpen={!!profileContact}
        onClose={() => setProfileContact(null)}
        contact={profileContact}
        onUpdate={() => {}}
      />

    </div>
  );
};
