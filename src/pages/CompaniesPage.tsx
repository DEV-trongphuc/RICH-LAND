import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Building2, X, Loader2, Pencil, Trash2, Globe, Phone, Mail, MapPin, Users, LayoutGrid, List, Filter, RefreshCw, Download, DollarSign, Briefcase, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { useUIStore } from '../store/uiStore';
import { CompanyDrawer } from './CompanyDrawer';
import { useAuth } from '../contexts/AuthContext';
import { Pagination } from '../components/ui/Pagination';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import api from '../api/axios';
import { PhoneLink } from '../components/ui/PhoneLink';
import { useDebounce } from '../hooks/useDebounce';
import { CustomSelect } from '../components/ui/CustomSelect';

const STATUSES = ['active', 'inactive', 'prospect'];
const ST_LABEL: Record<string, string> = { active: 'Hoạt động', inactive: 'Ngừng', prospect: 'Tiềm năng' };
const ST_CLASS: Record<string, string> = { active: 'success', inactive: 'danger', prospect: 'warning' };
const PAGE_SIZE = 10;

export const CompaniesPage: React.FC = () => {
  const { user } = useAuth();
  const isSale = user && ['sales', 'sale'].includes((user.role || '').toLowerCase());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [page, setPage] = useState(1);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [pageSize, setPageSize] = useState<number>(() => {
    return Number(localStorage.getItem('richland_companies_page_size')) || 10;
  });

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      
      const r = await api.get('/companies', { params });
      const data = r.data.data;
      setCompanies(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setCompanies([]);
      setTotal(0);
      addToast('Không thể tải danh sách đại lý/đối tác', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id') || urlParams.get('company_id');
    if (targetId) {
      const cid = Number(targetId);
      if (cid) {
        api.get(`/companies/${cid}`).then(res => {
          if (res.data.success && res.data.data) {
            setEditItem(res.data.data);
            setShowModal(true);
            
            // Clean URL parameters
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('id');
            newParams.delete('company_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        }).catch(err => {
          console.error("Error loading deep link company:", err);
        });
      }
    }
  }, [window.location.search]);

  const openCreate = () => { setEditItem(null); setShowModal(true); };
  const openEdit = (c: any) => { setEditItem(c); setShowModal(true); };

  const handleSaveCompany = async (formData: any) => {
    try {
      if (editItem) {
        await api.put(`/companies/${editItem.id}`, formData);
        addToast('Đã cập nhật đại lý/đối tác', 'success');
      } else {
        await api.post('/companies', formData);
        addToast('Đã thêm đại lý/đối tác mới', 'success');
      }
      if (!editItem) {
        setShowModal(false);
      }
      fetchCompanies();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu đối tác', 'error');
      throw err;
    }
  };

  const confirmDelete = (co: any) => {
    showConfirm({
      title: 'Xóa đối tác?',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn đối tác "${co.name}"? Thao tác này không thể hoàn tác.`,
      isDanger: true,
      impactInfo: `Cảnh báo: Xóa đối tác sẽ gỡ bỏ liên kết với ${co.contact_count || 0} liên hệ liên quan.`,
      confirmText: 'Xác nhận xóa',
      onConfirm: async () => {
        try {
          setDeleting(true);
          await api.delete(`/companies/${co.id}`);
          addToast('Đã xóa đối tác thành công', 'success');
          fetchCompanies();
        } catch (e: any) {
          addToast('Lỗi khi xóa đối tác', 'error');
        } finally {
          setDeleting(false);
          closeConfirm();
        }
      }
    });
  };

  const getTierLabel = (tier: string) => {
    if (!tier) return 'Đại lý F1';
    const t = String(tier).toLowerCase();
    if (t === 'ctv') return 'CTV / Môi giới';
    return 'Đại lý ' + t.toUpperCase();
  };

  return (
    <div className="page-container anim-fade-up">
      <div className="page-header" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: isMobile ? '1.45rem' : '1.75rem' }}>Đại lý & Đối tác</h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>{loading ? '...' : `${total} đại lý, CTV liên kết`}</p>
        </div>
        {!isSale && (
          <button 
            className="btn primary" 
            onClick={openCreate} 
            title="Thêm Đối tác" 
            style={{ 
              padding: isMobile ? '8px' : '8px 16px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              borderRadius: '8px',
              height: '36px',
              gap: '4px',
              flexShrink: 0
            }}
          >
            <Plus size={16} />
            {!isMobile && <span>Thêm Đối tác</span>}
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center', position: 'relative' }}>
          
          {/* Custom Styled Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <input
              type="text"
              placeholder="Tìm tên đại lý, khu vực thế mạnh..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input"
              style={{
                paddingLeft: '36px',
                borderRadius: '10px',
                fontSize: '0.875rem',
                width: '100%',
                height: '42px',
                border: '1px solid var(--color-border)'
              }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Status Filter ... Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFiltersMenu(!showFiltersMenu)}
              className="btn outline"
              style={{
                height: '42px',
                width: '42px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: statusFilter ? 'var(--color-primary-light)' : 'transparent',
                color: statusFilter ? 'var(--color-primary)' : 'var(--color-text)'
              }}
              title="Bộ lọc trạng thái"
            >
              <MoreHorizontal size={20} />
            </button>

            {/* Dropdown Popover */}
            {showFiltersMenu && (
              <>
                <div 
                  onClick={() => setShowFiltersMenu(false)}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                />
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '46px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  zIndex: 1000,
                  minWidth: '150px'
                }}>
                  <div style={{ padding: '6px 8px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                    Trạng thái
                  </div>
                  <button 
                    onClick={() => { setStatusFilter(''); setShowFiltersMenu(false); }}
                    style={{
                      padding: '8px 12px', fontSize: '0.8125rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      background: statusFilter === '' ? 'var(--color-bg)' : 'transparent',
                      color: 'var(--color-text)', fontWeight: statusFilter === '' ? 700 : 500
                    }}
                  >
                    Tất cả
                  </button>
                  {STATUSES.map(st => (
                    <button 
                      key={st}
                      onClick={() => { setStatusFilter(st); setShowFiltersMenu(false); }}
                      style={{
                        padding: '8px 12px', fontSize: '0.8125rem', textAlign: 'left', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: statusFilter === st ? 'var(--color-bg)' : 'transparent',
                        color: 'var(--color-text)', fontWeight: statusFilter === st ? 700 : 500
                      }}
                    >
                      {ST_LABEL[st]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Toggle View Mode Button */}
          <button
            onClick={() => setViewMode(viewMode === 'card' ? 'list' : 'card')}
            className="btn outline"
            style={{
              height: '42px',
              width: '42px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              border: '1px solid var(--color-border)'
            }}
            title={viewMode === 'card' ? "Xem dạng danh sách" : "Xem dạng lưới card"}
          >
            {viewMode === 'card' ? <List size={20} /> : <LayoutGrid size={20} />}
          </button>

          {!isSale && (
            <button
              onClick={() => setShowImportExport(true)}
              className="btn outline"
              style={{
                height: '42px',
                width: '42px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                border: '1px solid var(--color-border)'
              }}
              title="Xuất dữ liệu"
            >
              <Download size={20} />
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem' }}>
          <Loader2 size={36} className="spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      )}

      {/* Card Grid View */}
      {!loading && viewMode === 'card' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          <AnimatePresence>
            {companies.map(co => {
              return (
                <motion.div
                  key={co.id}
                  className="card card-hover"
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '16px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer'
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => openEdit(co)}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <Avatar name={co.name} src={co.logo_url} size={42} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={co.name}>
                            {co.name}
                          </h3>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                            <span className="badge sm" style={{ background: '#f3f4f6', color: '#6b7280', fontSize: '0.65rem', padding: '2px 6px' }}>
                              {getTierLabel(co.tier)}
                            </span>
                            {co.parent_name && (
                              <span className="badge sm" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', fontSize: '0.65rem', padding: '2px 6px', fontWeight: 700 }}>
                                Thuộc: {co.parent_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {!isSale && (
                        <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button className="btn ghost sm" onClick={() => openEdit(co)} style={{ padding: '4px', borderRadius: '4px', width: '24px', height: '24px' }}><Pencil size={12} /></button>
                          <button className="btn ghost sm text-danger" style={{ color: 'var(--color-danger)', padding: '4px', borderRadius: '4px', width: '24px', height: '24px' }} onClick={() => confirmDelete(co)}><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px 12px',
                      padding: '0.75rem 0',
                      borderTop: '1px solid var(--color-border-light)',
                      marginTop: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <Phone size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.phone || 'Chưa có SĐT'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <Mail size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={co.email}>{co.email || 'Chưa có Email'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <MapPin size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={co.address || co.city}>{co.address || co.city || 'Chưa có địa chỉ'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <Users size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.agent_count || 0} sales</span>
                      </div>
                      {co.focus_markets && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0, gridColumn: 'span 2' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.65rem', background: 'rgba(163, 20, 34, 0.08)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>Thế mạnh</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={co.focus_markets}>{co.focus_markets}</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'var(--color-text-muted)' }} title="Người liên hệ">
                          <Users size={11} />
                          {co.contact_count || 0} liên hệ
                        </span>
                      </div>
                      {co.dedicated_rep_id && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title={`Người phụ trách: ${co.rep_name || 'Chưa rõ'}`}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Phụ trách:</span>
                          <Avatar name={co.rep_name || 'CV'} src={co.rep_avatar} size={22} />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {total === 0 && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <Building2 size={40} />
              <h3>Chưa có đối tác nào</h3>
              <p>Thêm đại lý F1/F2 hoặc CTV liên kết đầu tiên.</p>
              {!isSale && <button className="btn primary mt-4" onClick={openCreate}><Plus size={16} /> Thêm Đối tác</button>}
            </div>
          )}
        </div>
      )}
      {!loading && viewMode === 'card' && total > pageSize && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onChange={setPage}
            showSizeChanger
            onPageSizeChange={size => {
              setPageSize(size);
              localStorage.setItem('richland_companies_page_size', String(size));
              setPage(1);
            }}
          />
        </div>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && (
        <div className="card" style={{ overflow: 'visible' }}>
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 700 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Đại lý / Đối tác</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Hotline / Email</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cấp đại lý</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Thế mạnh</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Số lượng Sales</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Trạng thái</th>
                  <th style={{ borderBottom: '1px solid var(--color-border)' }}></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {companies.map(co => (
                    <motion.tr
                      key={co.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="table-row-hover"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openEdit(co)}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div className="flex items-center gap-3">
                          <Avatar name={co.name} src={co.logo_url} size={32} />
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{co.name}</p>
                            <p className="text-xs text-light" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>{co.city || 'Chưa cập nhật tỉnh thành'}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {co.phone ? <PhoneLink phone={co.phone} style={{ fontSize: '0.875rem', fontWeight: 700 }} /> : <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>}
                          {co.email && <p className="text-xs text-light" style={{ color: 'var(--color-text-muted)' }}>{co.email}</p>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 600 }}>{getTierLabel(co.tier)}</p>
                          {co.parent_name && (
                            <p className="text-xs text-light" style={{ color: '#2563eb', fontWeight: 500 }}>Thuộc: {co.parent_name}</p>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{co.focus_markets || '—'}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 600 }}>{co.agent_count || 0} sales</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`badge ${ST_CLASS[co.status] || 'info'}`}>{ST_LABEL[co.status] || co.status}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        {!isSale && (
                          <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn ghost sm" onClick={() => openEdit(co)}><Pencil size={13} /></button>
                            <button className="btn ghost sm" style={{ color: 'var(--color-danger)' }} onClick={() => confirmDelete(co)}><Trash2 size={13} /></button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {total === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Không tìm thấy đối tác nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && viewMode === 'list' && total > pageSize && (
        <div className="card" style={{ marginTop: '0.25rem' }}>
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onChange={setPage}
            showSizeChanger
            onPageSizeChange={size => {
              setPageSize(size);
              localStorage.setItem('richland_companies_page_size', String(size));
              setPage(1);
            }}
          />
        </div>
      )}

      {/* Company Drawer */}
      <CompanyDrawer
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        entity={editItem}
        onSave={handleSaveCompany}
      />
      
      {/* Import Export Modal */}
      <ImportExportModal 
        isOpen={showImportExport} 
        onClose={() => setShowImportExport(false)} 
        entityName="Đối tác" 
        onExport={(format) => {
          const authRaw = localStorage.getItem('minth-auth');
          const authToken = authRaw ? JSON.parse(authRaw)?.state?.accessToken : '';
          const params = new URLSearchParams();
          params.set('type', 'company');
          params.set('token', authToken || localStorage.getItem('token') || '');
          if (debouncedSearch) params.set('search', debouncedSearch);
          if (statusFilter) params.set('status', statusFilter);
          window.open(`${api.defaults.baseURL}/export?${params.toString()}`, '_blank');
        }}
      />
    </div>
  );
};
