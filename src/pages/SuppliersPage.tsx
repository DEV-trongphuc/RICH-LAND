import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, Plus, Search, MoreHorizontal, Mail, Phone, MapPin, 
  Trash2, Pencil, ExternalLink, Filter, Download, User, Hash,
  ArrowUpRight, Building2, X
} from 'lucide-react';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../contexts/AuthContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { AddressSelect } from '../components/ui/AddressSelect';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Pagination } from '../components/ui/Pagination';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';

const PRESTIGE_OPTIONS = [
  { value: 'A', label: 'Hạng A (Rất uy tín)' },
  { value: 'B', label: 'Hạng B (Uy tín)' },
  { value: 'C', label: 'Hạng C (Trung bình)' }
];

const COOP_OPTIONS = [
  { value: 'active', label: 'Đang liên kết' },
  { value: 'negotiating', label: 'Đang đàm phán' },
  { value: 'suspended', label: 'Tạm ngưng' }
];

export const SuppliersPage: React.FC = () => {
  const { user } = useAuth();
  const isSale = user && ['sales', 'sale'].includes((user.role || '').toLowerCase());
  
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({ prestige_tier: '', cooperation_status: '' });
  const [draftFilters, setDraftFilters] = useState({ prestige_tier: '', cooperation_status: '' });
  
  useEffect(() => {
    if (showFilterModal) {
      setDraftFilters(filters);
    }
  }, [showFilterModal, filters]);

  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '', contact_name: '', email: '', phone: '', address: '', tax_code: '', notes: '',
    contact_position: '', website: '', scale_capital: '', typical_projects: '', focused_type: '', prestige_tier: 'A', cooperation_status: 'active', bank_account: ''
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchSuppliers = async () => {
    if (DEV_MODE) {
      const state = getFilteredMockState();
      let list = [...state.suppliers];
      
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        list = list.filter(sup => sup.name.toLowerCase().includes(s) || sup.contact_name?.toLowerCase().includes(s));
      }
      
      if (filters.prestige_tier) {
        list = list.filter(sup => sup.prestige_tier === filters.prestige_tier);
      }
      
      if (filters.cooperation_status) {
        list = list.filter(sup => sup.cooperation_status === filters.cooperation_status);
      }
      
      setSuppliers(list);
      setTotal(list.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = { page, limit: 12, search: searchTerm };
      if (filters.prestige_tier) params.prestige_tier = filters.prestige_tier;
      if (filters.cooperation_status) params.cooperation_status = filters.cooperation_status;
      const res = await api.get('/suppliers', { params });
      const data = res.data.data;
      setSuppliers(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      addToast('Lỗi khi tải danh sách chủ đầu tư', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, [page, filters]);

  // Handle search with debounce effect if needed, but for now simple trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) fetchSuppliers();
      else setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [isReadOnly, setIsReadOnly] = useState(false);

  const handleOpenModal = (s: any = null, readOnly: boolean = false) => {
    setSelectedSupplier(s);
    setFormData(s || {
      name: '', contact_name: '', email: '', phone: '', address: '', tax_code: '', notes: '',
      contact_position: '', website: '', scale_capital: '', typical_projects: '', focused_type: '', prestige_tier: 'A', cooperation_status: 'active', bank_account: ''
    });
    setIsReadOnly(s ? readOnly : false);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedSupplier) {
        await api.put(`/suppliers/${selectedSupplier.id}`, formData);
        addToast('Đã cập nhật chủ đầu tư', 'success');
      } else {
        await api.post('/suppliers', formData);
        addToast('Đã thêm chủ đầu tư mới', 'success');
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu dữ liệu', 'error');
    }
  };

  const handleDelete = (id: number) => {
    showConfirm({
      title: 'Xóa chủ đầu tư',
      message: 'Bạn có chắc chắn muốn xóa chủ đầu tư này?',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/suppliers/${id}`);
          setSuppliers(prev => prev.filter(s => s.id !== id));
          addToast('Đã xóa chủ đầu tư', 'success');
        } catch (e: any) {
          addToast('Lỗi khi xóa chủ đầu tư', 'error');
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const filtered = suppliers;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Chủ đầu tư</h1>
          <p className="page-subtitle">Quản lý danh sách các chủ đầu tư dự án bất động sản</p>
        </div>
        <div className="flex gap-3">
          <button className="btn outline" onClick={() => addToast('Tính năng đang phát triển', 'info')}>
            <Download size={18} /> Xuất Excel
          </button>
          {!isSale && (
            <button className="btn primary" onClick={() => handleOpenModal()}>
              <Plus size={18} /> Thêm chủ đầu tư
            </button>
          )}
        </div>
      </div>

      <div 
        style={{ 
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '16px',
          padding: '12px 16px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              background: 'var(--color-bg-light)', 
              border: '1px solid var(--color-border)', 
              borderRadius: '12px', 
              padding: '0 14px',
              height: '42px',
              transition: 'all 0.2s ease-in-out'
            }}
            className="search-input-container-focus"
          >
            <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input 
              type="text"
              placeholder="Tìm kiếm theo tên chủ đầu tư hoặc người liên hệ..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '0.875rem',
                color: 'var(--color-text)',
                padding: 0
              }}
            />
          </div>
          
          <button 
            type="button"
            onClick={() => setShowFilterModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: (filters.prestige_tier || filters.cooperation_status) ? 'rgba(163, 20, 34, 0.05)' : 'var(--color-surface)',
              border: (filters.prestige_tier || filters.cooperation_status) ? '1px solid var(--color-primary-light)' : '1px solid var(--color-border)',
              color: (filters.prestige_tier || filters.cooperation_status) ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderRadius: '12px',
              padding: '0 16px',
              height: '42px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
            className="filter-btn-hover"
          >
            <Filter size={15} /> 
            <span>Bộ lọc nâng cao</span>
            {(filters.prestige_tier || filters.cooperation_status) && (
              <span 
                style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: 'var(--color-primary)', 
                  position: 'absolute',
                  top: '6px',
                  right: '6px'
                }} 
              />
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner sm"></div>
        </div>
      ) : total === 0 ? (
        <EmptyCard 
          icon={<Truck size={48} />}
          title="Chưa có chủ đầu tư nào"
          description="Bắt đầu thêm các chủ đầu tư dự án để quản lý."
          actionText="Thêm ngay"
          onAction={() => handleOpenModal()}
        />
      ) : (
        <>
          <div className="grid grid-3">
            {filtered.map(s => (
              <motion.div 
                key={s.id} 
                className="card hover-lift relative overflow-hidden"
                style={{
                  padding: '1rem',
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
                onClick={() => handleOpenModal(s, true)}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.08), rgba(249, 115, 22, 0.08))',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Building2 size={16} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                          {s.name}
                        </h3>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                          <span className="badge sm" style={{ background: '#f3f4f6', color: '#6b7280', fontSize: '0.6rem', padding: '1px 4px' }}>
                            Chủ đầu tư
                          </span>
                          {s.prestige_tier && (
                            <span className="badge sm" style={{
                              background: s.prestige_tier === 'A' ? 'rgba(16, 185, 129, 0.1)' : s.prestige_tier === 'B' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                              color: s.prestige_tier === 'A' ? '#10b981' : s.prestige_tier === 'B' ? '#3b82f6' : '#6b7280',
                              fontSize: '0.6rem',
                              padding: '1px 4px'
                            }}>
                              Hạng {s.prestige_tier}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isSale && (
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="btn ghost sm" onClick={() => handleOpenModal(s)} style={{ padding: '4px', borderRadius: '4px', width: '24px', height: '24px' }}>
                          <Pencil size={12} />
                        </button>
                        <button className="btn ghost sm text-danger" onClick={() => handleDelete(s.id)} style={{ padding: '4px', borderRadius: '4px', width: '24px', height: '24px' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', padding: '0.5rem 0 0 0', borderTop: '1px solid var(--color-border-light)' }}>
                    {s.contact_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <User size={12} style={{ opacity: 0.6 }} />
                        <span style={{ fontWeight: 600 }}>
                          {s.contact_name} {s.contact_position ? `(${s.contact_position})` : ''}
                        </span>
                      </div>
                    )}
                    
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.02)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '8px',
                      padding: '8px',
                      marginTop: '4px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px 8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        <Phone size={11} style={{ opacity: 0.6 }} />
                        <span>{s.phone || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <Mail size={11} style={{ opacity: 0.6 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.email}>{s.email || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', minWidth: 0, gridColumn: 'span 2' }}>
                        <MapPin size={11} style={{ opacity: 0.6 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.address}>{s.address || '—'}</span>
                      </div>
                      {s.website && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', minWidth: 0, gridColumn: 'span 2' }}>
                          <ExternalLink size={11} style={{ opacity: 0.6 }} />
                          <a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                            {s.website}
                          </a>
                        </div>
                      )}
                    </div>

                    {s.typical_projects && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', minWidth: 0, marginTop: '4px' }}>
                        <Building2 size={11} style={{ opacity: 0.6 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }} title={s.typical_projects}>
                          Dự án: {s.typical_projects}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {total > 12 && (
            <div className="mt-6 flex justify-center">
              <Pagination total={total} page={page} pageSize={12} onChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Modal Cải tiến */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <div 
              className="overlay-backdrop" 
              onClick={() => setShowModal(false)} 
              style={{ 
                zIndex: 11000, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                position: 'fixed',
                inset: 0,
                padding: '20px',
                overflowY: 'auto'
              }}
            >
              <motion.div 
                className="modal-sheet modal-lg shadow-2xl"
                style={{ maxWidth: '900px', width: '100%' }}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>{isReadOnly ? 'Chi tiết đối tác' : (selectedSupplier ? 'Cập nhật đối tác' : 'Thêm chủ đầu tư mới')}</h3>
                  <button className="btn-icon sm" onClick={() => setShowModal(false)}><ArrowUpRight size={18} style={{ transform: 'rotate(45deg)' }} /></button>
                </div>

                {isReadOnly ? (
                  <>
                    <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                        {/* Left Column: Enterprise Info */}
                        <div>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: '0.05em', marginBottom: '16px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border-light)' }}>
                            Thông tin doanh nghiệp
                          </h4>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Tên doanh nghiệp / Chủ đầu tư</span>
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>{formData.name || '—'}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Mã số thuế</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formData.tax_code || '—'}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Vốn điều lệ / Quy mô</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formData.scale_capital || '—'}</span>
                              </div>
                            </div>

                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Website doanh nghiệp</span>
                              {formData.website ? (
                                <a href={formData.website.startsWith('http') ? formData.website : `https://${formData.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }} onClick={e => e.stopPropagation()}>
                                  {formData.website}
                                </a>
                              ) : (
                                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>—</span>
                              )}
                            </div>

                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Phân khúc BĐS tập trung</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formData.focused_type || '—'}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Phân hạng uy tín</span>
                                <div>
                                  <span className="badge" style={{
                                    background: formData.prestige_tier === 'A' ? 'rgba(16, 185, 129, 0.1)' : formData.prestige_tier === 'B' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                                    color: formData.prestige_tier === 'A' ? '#10b981' : formData.prestige_tier === 'B' ? '#3b82f6' : '#6b7280',
                                    fontSize: '0.7rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 600
                                  }}>
                                    Hạng {formData.prestige_tier || 'A'}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Trạng thái hợp tác</span>
                                <div>
                                  <span className="badge" style={{
                                    background: formData.cooperation_status === 'active' ? 'rgba(16, 185, 129, 0.1)' : formData.cooperation_status === 'negotiating' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: formData.cooperation_status === 'active' ? '#10b981' : formData.cooperation_status === 'negotiating' ? '#f59e0b' : '#ef4444',
                                    fontSize: '0.7rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 600
                                  }}>
                                    {formData.cooperation_status === 'active' ? 'Đang liên kết' : formData.cooperation_status === 'negotiating' ? 'Đang đàm phán' : 'Tạm ngưng'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Contact & Transaction Info */}
                        <div>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: '0.05em', marginBottom: '16px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border-light)' }}>
                            Thông tin liên hệ & Giao dịch
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Người liên hệ</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formData.contact_name || '—'}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Chức vụ</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formData.contact_position || '—'}</span>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Số điện thoại</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formData.phone || '—'}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Email</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formData.email || '—'}</span>
                              </div>
                            </div>

                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Tài khoản ngân hàng giao dịch</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formData.bank_account || '—'}</span>
                            </div>

                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Địa chỉ văn phòng</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formData.address || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Full Width Bottom Area */}
                      <div style={{ marginTop: '20px', borderTop: '1px solid var(--color-border-light)', paddingTop: '20px' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Danh sách dự án tiêu biểu</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{formData.typical_projects || '—'}</span>
                        </div>

                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Ghi chú thêm</span>
                          <div style={{ fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'pre-wrap', background: 'rgba(0, 0, 0, 0.01)', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                            {formData.notes || 'Không có ghi chú thêm.'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>Đóng</button>
                      {!isSale && (
                        <button type="button" className="btn primary" onClick={() => setIsReadOnly(false)}>Chỉnh sửa</button>
                      )}
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                        {/* Left Column: Enterprise Info */}
                        <div>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: '0.05em', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border-light)' }}>
                            Thông tin doanh nghiệp
                          </h4>
                          
                          <div className="form-group">
                            <label className="form-label">Tên doanh nghiệp / Chủ đầu tư <span className="text-danger">*</span></label>
                            <input 
                              className="form-input" 
                              placeholder="Ví dụ: Vingroup, Novaland..."
                              required 
                              value={formData.name}
                              onChange={e => setFormData({...formData, name: e.target.value})}
                              disabled={isReadOnly}
                            />
                          </div>

                          <div className="grid grid-2">
                            <div className="form-group">
                              <label className="form-label">Mã số thuế</label>
                              <input 
                                className="form-input" 
                                placeholder="MST doanh nghiệp"
                                value={formData.tax_code || ''}
                                onChange={e => setFormData({...formData, tax_code: e.target.value})}
                                disabled={isReadOnly}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Vốn điều lệ / Quy mô</label>
                              <input 
                                className="form-input" 
                                placeholder="Ví dụ: 5.000 tỷ..."
                                value={formData.scale_capital || ''}
                                onChange={e => setFormData({...formData, scale_capital: e.target.value})}
                                disabled={isReadOnly}
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Website doanh nghiệp</label>
                            <input 
                              className="form-input" 
                              placeholder="https://..."
                              value={formData.website || ''}
                              onChange={e => setFormData({...formData, website: e.target.value})}
                              disabled={isReadOnly}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Phân khúc BĐS tập trung</label>
                            <input 
                              className="form-input" 
                              placeholder="Ví dụ: Căn hộ cao cấp, Đất nền, Nghỉ dưỡng..."
                              value={formData.focused_type || ''}
                              onChange={e => setFormData({...formData, focused_type: e.target.value})}
                              disabled={isReadOnly}
                            />
                          </div>

                          <div className="grid grid-2">
                            <div className="form-group">
                              <label className="form-label">Phân hạng uy tín</label>
                              <CustomSelect 
                                options={PRESTIGE_OPTIONS}
                                value={formData.prestige_tier || 'A'}
                                onChange={val => setFormData({...formData, prestige_tier: val})}
                                disabled={isReadOnly}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Trạng thái hợp tác</label>
                              <CustomSelect 
                                options={COOP_OPTIONS}
                                value={formData.cooperation_status || 'active'}
                                onChange={val => setFormData({...formData, cooperation_status: val})}
                                disabled={isReadOnly}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Contact & Transaction Info */}
                        <div>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: '0.05em', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border-light)' }}>
                            Thông tin liên hệ & Giao dịch
                          </h4>

                          <div className="grid grid-2">
                            <div className="form-group">
                              <label className="form-label">Người liên hệ</label>
                              <input 
                                className="form-input" 
                                placeholder="Họ và tên"
                                value={formData.contact_name || ''}
                                onChange={e => setFormData({...formData, contact_name: e.target.value})}
                                disabled={isReadOnly}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Chức vụ</label>
                              <input 
                                className="form-input" 
                                placeholder="Ví dụ: GĐ Kinh doanh..."
                                value={formData.contact_position || ''}
                                onChange={e => setFormData({...formData, contact_position: e.target.value})}
                                disabled={isReadOnly}
                              />
                            </div>
                          </div>

                          <div className="grid grid-2">
                            <div className="form-group">
                              <label className="form-label">Số điện thoại</label>
                              <input 
                                className="form-input" 
                                placeholder="09xx..."
                                value={formData.phone || ''}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                                disabled={isReadOnly}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Email</label>
                              <input 
                                className="form-input" 
                                type="email"
                                placeholder="developer@email.com"
                                value={formData.email || ''}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                disabled={isReadOnly}
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Tài khoản ngân hàng giao dịch</label>
                            <input 
                              className="form-input" 
                              placeholder="Số TK - Tên NH - Chi nhánh..."
                              value={formData.bank_account || ''}
                              onChange={e => setFormData({...formData, bank_account: e.target.value})}
                              disabled={isReadOnly}
                            />
                          </div>

                          <div className="form-group">
                            <AddressSelect
                              label="Địa chỉ văn phòng"
                              value={formData.address || ''}
                              onChange={val => setFormData({...formData, address: val})}
                              placeholder="Chọn địa chỉ văn phòng..."
                              disabled={isReadOnly}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Full Width Bottom Area */}
                      <div style={{ marginTop: '20px', borderTop: '1px solid var(--color-border-light)', paddingTop: '20px' }}>
                        <div className="form-group">
                          <label className="form-label">Danh sách dự án tiêu biểu</label>
                          <input 
                            className="form-input" 
                            placeholder="Ví dụ: Vinhomes Grand Park, Masteri Centre Point..."
                            value={formData.typical_projects || ''}
                            onChange={e => setFormData({...formData, typical_projects: e.target.value})}
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Ghi chú thêm</label>
                          <textarea 
                            className="form-textarea" 
                            placeholder="Thông tin thêm về chủ đầu tư..."
                            value={formData.notes || ''}
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                            rows={3}
                            disabled={isReadOnly}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>Hủy bỏ</button>
                      <button type="submit" className="btn primary">
                        {selectedSupplier ? 'Lưu thay đổi' : 'Tạo chủ đầu tư'}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      , document.body)}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showFilterModal && (
            <div 
              className="overlay-backdrop" 
              onClick={() => setShowFilterModal(false)} 
              style={{ 
                zIndex: 11000, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                position: 'fixed',
                inset: 0,
                padding: '20px',
                background: 'rgba(0, 0, 0, 0.42)',
                backdropFilter: 'blur(4px)'
              }}
            >
              <motion.div 
                className="modal-sheet shadow-2xl"
                style={{ maxWidth: '420px', width: '100%', borderRadius: '16px', overflow: 'hidden', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}><Filter size={18} /> Bộ lọc nâng cao</h3>
                  <button className="btn-icon sm" onClick={() => setShowFilterModal(false)}><X size={18} /></button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Phân hạng uy tín</label>
                    <CustomSelect 
                      options={[
                        { value: '', label: 'Tất cả phân hạng' },
                        ...PRESTIGE_OPTIONS
                      ]}
                      value={draftFilters.prestige_tier}
                      onChange={val => setDraftFilters({ ...draftFilters, prestige_tier: val })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Trạng thái hợp tác</label>
                    <CustomSelect 
                      options={[
                        { value: '', label: 'Tất cả trạng thái' },
                        ...COOP_OPTIONS
                      ]}
                      value={draftFilters.cooperation_status}
                      onChange={val => setDraftFilters({ ...draftFilters, cooperation_status: val })}
                    />
                  </div>
                </div>

                <div className="modal-footer" style={{ background: 'var(--color-bg-light)', display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 20px', borderTop: '1px solid var(--color-border-light)' }}>
                  <button 
                    type="button" 
                    className="btn secondary" 
                    onClick={() => {
                      setFilters({ prestige_tier: '', cooperation_status: '' });
                      setShowFilterModal(false);
                    }}
                    style={{ flex: 1, height: '38px', borderRadius: '10px' }}
                  >
                    Thiết lập lại
                  </button>
                  <button 
                    type="button" 
                    className="btn primary" 
                    onClick={() => {
                      setFilters(draftFilters);
                      setShowFilterModal(false);
                    }}
                    style={{ flex: 1, height: '38px', borderRadius: '10px' }}
                  >
                    Áp dụng
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      , document.body)}
    </div>
  );
};
