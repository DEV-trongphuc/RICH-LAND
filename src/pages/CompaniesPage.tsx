import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Building2, X, Loader2, Pencil, Trash2, Globe, Phone, Mail, Users, LayoutGrid, List, Filter, RefreshCw, Download, DollarSign, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { useUIStore } from '../store/uiStore';
import { CompanyDrawer } from './CompanyDrawer';
import { Pagination } from '../components/ui/Pagination';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import api from '../api/axios';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import { PhoneLink } from '../components/ui/PhoneLink';
import { useDebounce } from '../hooks/useDebounce';

const STATUSES = ['active', 'inactive', 'prospect'];
const ST_LABEL: Record<string, string> = { active: 'Hoạt động', inactive: 'Ngừng', prospect: 'Tiềm năng' };
const ST_CLASS: Record<string, string> = { active: 'success', inactive: 'danger', prospect: 'warning' };
const PAGE_SIZE = 10;

export const CompaniesPage: React.FC = () => {
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [page, setPage] = useState(1);
  const [showImportExport, setShowImportExport] = useState(false);

  const fetchCompanies = useCallback(async () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      let list = [...state.companies];
      
      if (debouncedSearch) {
        const s = debouncedSearch.toLowerCase();
        list = list.filter(c => c.name.toLowerCase().includes(s) || c.industry?.toLowerCase().includes(s));
      }
      
      if (statusFilter) {
        list = list.filter(c => c.status === statusFilter);
      }
      
      setCompanies(list);
      setTotal(list.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = { page, limit: PAGE_SIZE };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      
      const r = await api.get('/companies', { params });
      const data = r.data.data;
      setCompanies(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setCompanies([]);
      setTotal(0);
      addToast('Không thể tải danh sách công ty', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const openCreate = () => { setEditItem(null); setShowModal(true); };
  const openEdit = (c: any) => { setEditItem(c); setShowModal(true); };

  const handleSaveCompany = async (formData: any) => {
    try {
      if (editItem) {
        await api.put(`/companies/${editItem.id}`, formData);
        addToast('Đã cập nhật công ty', 'success');
      } else {
        await api.post('/companies', formData);
        addToast('Đã thêm công ty mới', 'success');
      }
      setShowModal(false);
      fetchCompanies();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu công ty', 'error');
      throw err;
    }
  };

  const confirmDelete = (co: any) => {
    showConfirm({
      title: 'Xóa công ty?',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn công ty "${co.name}"? Thao tác này không thể hoàn tác.`,
      isDanger: true,
      impactInfo: `Cảnh báo: Xóa công ty sẽ gỡ bỏ liên kết với ${co.contact_count || 0} liên hệ và toàn bộ lịch sử hoạt động liên quan.`,
      confirmText: 'Xác nhận xóa',
      onConfirm: async () => {
        try {
          setDeleting(true);
          await api.delete(`/companies/${co.id}`);
          addToast('Đã xóa công ty thành công', 'success');
          fetchCompanies();
        } catch (e: any) {
          addToast('Lỗi khi xóa công ty', 'error');
        } finally {
          setDeleting(false);
          closeConfirm();
        }
      }
    });
  };

  return (
    <div className="page-container anim-fade-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Công ty</h1>
          <p className="page-subtitle">{loading ? '...' : `${total} công ty khách hàng`}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-icon" onClick={fetchCompanies} title="Làm mới">
            <RefreshCw size={16} />
          </button>
          <button className="btn outline" onClick={() => setShowImportExport(true)} title="Nhập/Xuất">
            <Download size={16} />
            <span className="hide-on-mobile"> Nhập/Xuất</span>
          </button>
          <button className="btn primary" onClick={openCreate} title="Thêm công ty">
            <Plus size={16} />
            <span className="hide-on-mobile"> Thêm công ty</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.875rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="filter-search" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ color: 'var(--color-text-muted)' }} />
          <input placeholder="Tìm tên công ty, ngành nghề..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
        </div>

        {/* Mobile Status Select */}
        <div className="mobile-only" style={{ width: '100%' }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="form-select"
            style={{ width: '100%', height: 40 }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
            <option value="prospect">Tiềm năng</option>
          </select>
        </div>

        {/* Desktop Status Buttons */}
        <div className="hide-on-mobile" style={{ display: 'flex', gap: '0.5rem' }}>
          {['', ...STATUSES].map(s => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`btn sm ${statusFilter === s ? 'primary' : 'outline'}`}
            >
              {s ? ST_LABEL[s] : 'Tất cả'}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--color-border)' }} />

        <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: '8px', padding: '2px', border: '1px solid var(--color-border)' }}>
          <button
            className="btn ghost sm"
            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', background: viewMode === 'card' ? 'var(--color-surface)' : 'transparent' }}
            onClick={() => setViewMode('card')} title="Dạng thẻ"
          ><LayoutGrid size={15} /></button>
          <button
            className="btn ghost sm"
            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent' }}
            onClick={() => setViewMode('list')} title="Dạng danh sách"
          ><List size={15} /></button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className={viewMode === 'card' ? 'grid-cards-responsive' : ''} style={{ display: viewMode === 'card' ? undefined : 'grid', gridTemplateColumns: viewMode === 'card' ? undefined : '1fr', gap: '1rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: viewMode === 'card' ? 180 : 56, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      )}

      {/* Card View */}
      {!loading && viewMode === 'card' && (
        <div className="grid-cards-responsive">
          <AnimatePresence>
            {companies.map(co => (
              <motion.div
                key={co.id}
                className="card card-hover"
                style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => openEdit(co)}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                      <Avatar name={co.name} src={co.logo_url} size={40} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={co.name}>{co.name}</p>
                        <p className="text-xs text-light" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={co.industry}>{co.industry}{co.city ? ` · ${co.city}` : ''}</p>
                      </div>
                    </div>
                    <span className={`badge ${ST_CLASS[co.status] || 'info'}`} style={{ flexShrink: 0 }}>{ST_LABEL[co.status] || co.status}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', marginBottom: '1.25rem', marginTop: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                    {co.phone ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <Phone size={12} className="text-light" style={{ flexShrink: 0 }} />
                        <PhoneLink phone={co.phone} style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
                      </div>
                    ) : <div />}
                    {co.email ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }} title={co.email}>
                        <Mail size={12} className="text-light" style={{ flexShrink: 0 }} />
                        <span className="text-xs text-light" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.email}</span>
                      </div>
                    ) : <div />}
                    {co.website ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }} title={co.website}>
                        <Globe size={12} className="text-light" style={{ flexShrink: 0 }} />
                        <span className="text-xs text-light" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.website}</span>
                      </div>
                    ) : <div />}
                    {co.expected_revenue > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <DollarSign size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                        <span className="text-xs font-black" style={{ color: 'var(--color-success)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {new Intl.NumberFormat('vi-VN').format(co.expected_revenue)} đ
                        </span>
                      </div>
                    ) : <div />}
                  </div>
                </div>

                <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                  <div className="flex gap-2 items-center">
                    <span className="flex items-center gap-1 text-xs text-light" title="Người liên hệ"><Users size={12} />{co.contact_count || 0}</span>
                    <span className="flex items-center gap-1 text-xs text-light" title="Quy mô"><Briefcase size={12} />{co.size || '1-10'} nv</span>
                    {co.stage_name && <span className="badge sm" style={{ background: (co.stage_color || '#a31422') + '15', color: co.stage_color || '#a31422', fontSize: '0.65rem' }}>{co.stage_name}</span>}
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button className="btn ghost sm" onClick={() => openEdit(co)} style={{ padding: '4px' }}><Pencil size={13} /></button>
                    <button className="btn ghost sm" style={{ color: 'var(--color-danger)', padding: '4px' }} onClick={() => confirmDelete(co)}><Trash2 size={13} /></button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {total === 0 && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <Building2 size={40} />
              <h3>Chưa có công ty nào</h3>
              <p>Thêm công ty đầu tiên để bắt đầu quản lý khách hàng doanh nghiệp.</p>
              <button className="btn primary mt-4" onClick={openCreate}><Plus size={16} /> Thêm công ty</button>
            </div>
          )}
        </div>
      )}
      {!loading && viewMode === 'card' && companies.length > PAGE_SIZE && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <Pagination total={total} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}

      {/* List View */}
      {!loading && viewMode === 'list' && (
        <div className="card" style={{ overflow: 'visible' }}>
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Công ty</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Liên hệ</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Phân loại</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Trạng thái</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Dự kiến</th>
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
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                      onClick={() => openEdit(co)}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div className="flex items-center gap-3">
                          <Avatar name={co.name} src={co.logo_url} size={32} />
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{co.name}</p>
                            <p className="text-xs text-light" style={{ color: 'var(--color-text-muted)', marginTop: '2px' }}>{co.website || co.city}</p>
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
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 500 }}>{co.industry || '—'}</p>
                          {co.size && <p className="text-xs text-light" style={{ color: 'var(--color-text-muted)' }}>Quy mô: {co.size}</p>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`badge ${ST_CLASS[co.status] || 'info'}`}>{ST_LABEL[co.status] || co.status}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-primary)' }}>
                            {co.expected_revenue > 0 ? new Intl.NumberFormat('vi-VN').format(co.expected_revenue) + ' đ' : '—'}
                          </span>
                          {co.stage_name && (
                            <div>
                              <span className="badge sm" style={{ background: (co.stage_color || '#a31422') + '15', color: co.stage_color || '#a31422', padding: '2px 8px', fontSize: '0.7rem' }}>
                                {co.stage_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn ghost sm" onClick={() => openEdit(co)}><Pencil size={13} /></button>
                          <button className="btn ghost sm" style={{ color: 'var(--color-danger)' }} onClick={() => confirmDelete(co)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {total === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Không tìm thấy công ty nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!loading && viewMode === 'list' && (
        <div className="card" style={{ marginTop: '0.25rem' }}>
          <Pagination total={total} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
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
        entityName="Công ty" 
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
