import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, Plus, Search, MoreHorizontal, Mail, Phone, MapPin, 
  Trash2, Pencil, ExternalLink, Filter, Download, User, Hash,
  ArrowUpRight, Building2, X, Layers
} from 'lucide-react';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../contexts/AuthContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { AddressSelect } from '../components/ui/AddressSelect';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Pagination } from '../components/ui/Pagination';
import { Avatar } from '../components/ui/Avatar';
import styles from './EntityDrawer.module.css';

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

const SUPPLIER_TABS = [
  { id: 'info', label: 'Thông tin chung', icon: <Building2 size={16} /> },
  { id: 'projects', label: 'Dự án tiêu biểu', icon: <Layers size={16} /> }
];

export const SuppliersPage: React.FC = () => {
  const { user } = useAuth();
  const isSale = user && ['sales', 'sale', 'viewer'].includes((user.role || '').toLowerCase());
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ prestige_tier: '', cooperation_status: '' });
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [projSearch, setProjSearch] = useState('');
  const [showProjDropdown, setShowProjDropdown] = useState(false);
  
  const [activeTab, setActiveTab] = useState('info');
  const [isVisible, setIsVisible] = useState(showModal);
  const [animateIn, setAnimateIn] = useState(showModal);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (showModal) {
      setIsVisible(true);
      const timer = setTimeout(() => setAnimateIn(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setIsVisible(false), 420);
      return () => clearTimeout(timer);
    }
  }, [showModal]);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  useEffect(() => {
    api.get('/projects?all=1')
      .then(res => {
        const list = res.data.data || res.data || [];
        setProjectsList(Array.isArray(list) ? list : (list.items || []));
      })
      .catch(() => {});
  }, []);

  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '', contact_name: '', email: '', phone: '', address: '', tax_code: '', notes: '',
    contact_position: '', website: '', scale_capital: '', typical_projects: '', focused_type: '', prestige_tier: 'A', cooperation_status: 'active', bank_account: ''
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSuppliers = async () => {
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
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
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
    setActiveTab('info');
    setShowModal(true);
  };

  const handleAddProject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = formData.typical_projects ? formData.typical_projects.split(',').map(p => p.trim()).filter(Boolean) : [];
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed].join(', ');
      setFormData(prev => ({ ...prev, typical_projects: updated }));
    }
    setProjSearch('');
    setShowProjDropdown(false);
  };

  const handleRemoveProject = (name: string) => {
    const current = formData.typical_projects ? formData.typical_projects.split(',').map(p => p.trim()).filter(Boolean) : [];
    const updated = current.filter(p => p !== name).join(', ');
    setFormData(prev => ({ ...prev, typical_projects: updated }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    try {
      setIsSaving(true);
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
    } finally {
      setIsSaving(false);
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
  const selectedProjects = formData.typical_projects ? formData.typical_projects.split(',').map((p: any) => p.trim()).filter(Boolean) : [];

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

      {/* Control row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '12px',
        padding: '0.625rem 1.25rem',
        marginBottom: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        width: '100%'
      }}>
        {/* Left: Search input */}
        <div 
          style={{ 
            flex: '1 1 300px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            background: 'var(--color-bg-light)', 
            border: '1px solid var(--color-border-light)', 
            borderRadius: '10px', 
            padding: '0 12px',
            height: '36px',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <Search size={14} style={{ color: 'var(--color-text-muted)', opacity: 0.7 }} />
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
              fontSize: '0.825rem',
              color: 'var(--color-text)',
              padding: 0
            }}
          />
        </div>

        {/* Right side: Filters & Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Filter 1: Prestige Tier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Phân hạng:</span>
            <select
              value={filters.prestige_tier}
              onChange={e => setFilters({ ...filters, prestige_tier: e.target.value })}
              style={{
                padding: '0 8px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-surface)',
                fontSize: '0.8rem',
                fontWeight: 650,
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Tất cả phân hạng</option>
              {PRESTIGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Filter 2: Cooperation Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Hợp tác:</span>
            <select
              value={filters.cooperation_status}
              onChange={e => setFilters({ ...filters, cooperation_status: e.target.value })}
              style={{
                padding: '0 8px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-surface)',
                fontSize: '0.8rem',
                fontWeight: 650,
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {COOP_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Count Badge */}
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'var(--color-bg-light)',
            color: 'var(--color-text-muted)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-light)',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}>
            Hiển thị <strong style={{ color: 'var(--color-primary)', marginLeft: '4px', marginRight: '4px' }}>{total}</strong> chủ đầu tư
          </div>
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
          actionText={isSale ? undefined : "Thêm ngay"}
          onAction={isSale ? undefined : () => handleOpenModal()}
        />
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            {filtered.map(s => {
              const cardProjList = s.typical_projects 
                ? s.typical_projects.split(',').map((p: any) => p.trim()).filter(Boolean) 
                : [];

              return (
                <motion.div 
                  key={s.id} 
                  className="card hover-lift relative overflow-hidden"
                  style={{
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    minHeight: '180px'
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleOpenModal(s, true)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <Avatar name={s.name} size={36} />
                      <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                          {s.name}
                        </h3>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px', alignItems: 'center' }}>
                          {s.prestige_tier && (
                            <span className="badge sm" style={{ background: '#f3f4f6', color: '#4b5563', fontSize: '0.65rem', padding: '1px 6px' }}>
                              Hạng {s.prestige_tier}
                            </span>
                          )}
                          {s.cooperation_status && (
                            <span className={`badge sm ${s.cooperation_status === 'active' ? 'success' : s.cooperation_status === 'negotiating' ? 'warning' : 'danger'}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                              {s.cooperation_status === 'active' ? 'Đang liên kết' : s.cooperation_status === 'negotiating' ? 'Đang đàm phán' : 'Tạm ngưng'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isSale && (
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button className="btn ghost sm" onClick={() => handleOpenModal(s)} style={{ padding: '4px', borderRadius: '4px', width: '24px', height: '24px' }}><Pencil size={12} /></button>
                        <button className="btn ghost sm text-danger" style={{ color: 'var(--color-danger)', padding: '4px', borderRadius: '4px', width: '24px', height: '24px' }} onClick={() => handleDelete(s.id)}><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>

                  {/* Clean, simple details list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px', flex: 1, textAlign: 'left' }}>
                    {s.contact_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <span style={{ color: 'var(--color-text-light)' }}>Đại diện:</span>
                        <span style={{ fontWeight: 650, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.contact_name} {s.contact_position ? `(${s.contact_position})` : ''}
                        </span>
                      </div>
                    )}
                    {s.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <Phone size={11} style={{ opacity: 0.5 }} />
                        <span>{s.phone}</span>
                      </div>
                    )}
                    {s.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <Mail size={11} style={{ opacity: 0.5 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.email}>{s.email}</span>
                      </div>
                    )}
                    {s.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <MapPin size={11} style={{ opacity: 0.5 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.address}>{s.address}</span>
                      </div>
                    )}
                    {cardProjList.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)', minWidth: 0, marginTop: '2px', flexWrap: 'wrap' }}>
                        <Building2 size={11} style={{ opacity: 0.5, marginTop: '2px', flexShrink: 0 }} />
                        <span style={{ color: 'var(--color-text-light)', flexShrink: 0 }}>Dự án:</span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                          {cardProjList.map((proj, pIdx) => {
                            const pId = projectsList.find(p => p.name.trim().toLowerCase() === proj.trim().toLowerCase())?.id;
                            return (
                              <span
                                key={pIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (pId) {
                                    window.location.href = `/projects?project_id=${pId}`;
                                  } else {
                                    window.location.href = `/projects?search=${encodeURIComponent(proj)}`;
                                  }
                                }}
                                style={{
                                  color: 'var(--color-primary)',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Click để mở chi tiết dự án"
                              >
                                {proj}{pIdx < cardProjList.length - 1 ? ',' : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {total > 12 && (
            <div className="mt-6 flex justify-center">
              <Pagination total={total} page={page} pageSize={12} onChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* Drawer Cải tiến */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <>
              {/* Backdrop */}
              <div
                className="drawer-backdrop"
                onClick={() => setShowModal(false)}
                style={{
                  zIndex: 10000,
                  opacity: animateIn ? 1 : 0,
                  transition: 'opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
                  pointerEvents: animateIn ? 'auto' : 'none'
                }}
              />

              {/* Drawer Sheet */}
              <div
                className={styles.drawer}
                style={{
                  transform: animateIn ? 'translateX(0)' : 'translateX(160px)',
                  opacity: animateIn ? 1 : 0,
                  transition: 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'transform, opacity',
                  zIndex: 10600
                }}
              >
                {/* Header */}
                <div className={styles.header} style={{ borderBottom: '1px solid var(--color-border-light)', padding: '1.25rem 1.5rem', background: 'var(--color-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar name={formData.name || 'C'} size={40} />
                    <div style={{ textAlign: 'left' }}>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                        {formData.name || 'Thêm đối tác mới'}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        <span>MST: {formData.tax_code || '—'}</span>
                        <span>•</span>
                        <span>Hạng: {formData.prestige_tier || 'A'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {formData.cooperation_status && (
                      <span className={`badge sm ${formData.cooperation_status === 'active' ? 'success' : formData.cooperation_status === 'negotiating' ? 'warning' : 'danger'}`}>
                        {formData.cooperation_status === 'active' ? 'Đang liên kết' : formData.cooperation_status === 'negotiating' ? 'Đang đàm phán' : 'Tạm ngưng'}
                      </span>
                    )}

                    {!isReadOnly ? (
                      <button 
                        type="button" 
                        onClick={handleSubmit} 
                        className="btn primary sm" 
                        disabled={isSaving}
                        style={{ height: '32px', fontSize: '0.8rem', padding: '0 14px', borderRadius: '8px' }}
                      >
                        {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </button>
                    ) : (
                      !isSale && (
                        <button 
                          type="button" 
                          onClick={() => setIsReadOnly(false)} 
                          className="btn primary sm"
                          style={{ height: '32px', fontSize: '0.8rem', padding: '0 14px', borderRadius: '8px' }}
                        >
                          Chỉnh sửa
                        </button>
                      )
                    )}
                    <button className={styles.closeBtn} onClick={() => setShowModal(false)}><X size={20} /></button>
                  </div>
                </div>

                {/* Drawer Body - Simple 2-column view */}
                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
                    
                    {/* Left Column: Enterprise Info */}
                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '20px' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px', marginBottom: '16px', textAlign: 'left' }}>
                        Thông tin doanh nghiệp
                      </h3>

                      {isReadOnly ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Tên chủ đầu tư / đối tác</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{formData.name || '—'}</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Mã số thuế</span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.tax_code || '—'}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Vốn điều lệ / Quy mô</span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.scale_capital || '—'}</span>
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Website</span>
                            {formData.website ? (
                              <a href={formData.website.startsWith('http') ? formData.website : `https://${formData.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
                                {formData.website} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>—</span>
                            )}
                          </div>

                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Phân khúc BĐS tập trung</span>
                            <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.focused_type || '—'}</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Phân hạng uy tín</span>
                              <div>
                                <span className="badge sm" style={{ background: '#f3f4f6', color: '#4b5563' }}>Hạng {formData.prestige_tier || 'A'}</span>
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Trạng thái hợp tác</span>
                              <div>
                                <span className={`badge sm ${formData.cooperation_status === 'active' ? 'success' : formData.cooperation_status === 'negotiating' ? 'warning' : 'danger'}`}>
                                  {formData.cooperation_status === 'active' ? 'Đang liên kết' : formData.cooperation_status === 'negotiating' ? 'Đang đàm phán' : 'Tạm ngưng'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                          <div className="form-group">
                            <label className="form-label">Tên doanh nghiệp / Chủ đầu tư <span className="text-danger">*</span></label>
                            <input 
                              className="form-input" 
                              placeholder="Ví dụ: Vingroup, Novaland..."
                              required 
                              value={formData.name}
                              onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                              <label className="form-label">Mã số thuế</label>
                              <input 
                                className="form-input" 
                                placeholder="MST doanh nghiệp"
                                value={formData.tax_code || ''}
                                onChange={e => setFormData({...formData, tax_code: e.target.value})}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Vốn điều lệ / Quy mô</label>
                              <input 
                                className="form-input" 
                                placeholder="Ví dụ: 5.000 tỷ..."
                                value={formData.scale_capital || ''}
                                onChange={e => setFormData({...formData, scale_capital: e.target.value})}
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
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Phân khúc BĐS tập trung</label>
                            <input 
                              className="form-input" 
                              placeholder="Ví dụ: Căn hộ cao cấp, Đất nền, Nghỉ dưỡng..."
                              value={formData.focused_type || ''}
                              onChange={e => setFormData({...formData, focused_type: e.target.value})}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group">
                              <label className="form-label">Phân hạng uy tín</label>
                              <CustomSelect 
                                options={PRESTIGE_OPTIONS}
                                value={formData.prestige_tier || 'A'}
                                  onChange={val => setFormData({...formData, prestige_tier: val})}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Trạng thái hợp tác</label>
                                <CustomSelect 
                                  options={COOP_OPTIONS}
                                  value={formData.cooperation_status || 'active'}
                                  onChange={val => setFormData({...formData, cooperation_status: val})}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Contact Info & Transaction Details */}
                      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '20px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px', marginBottom: '16px', textAlign: 'left' }}>
                          Thông tin liên hệ & Giao dịch
                        </h3>

                        {isReadOnly ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                              <div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Người liên hệ</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{formData.contact_name || '—'}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Chức vụ</span>
                                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{formData.contact_position || '—'}</span>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                              <div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Số điện thoại</span>
                                <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 600 }}>{formData.phone || '—'}</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Email</span>
                                <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.email || '—'}</span>
                              </div>
                            </div>

                            <div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Tài khoản ngân hàng giao dịch</span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.bank_account || '—'}</span>
                            </div>

                            <div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Địa chỉ văn phòng</span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{formData.address || '—'}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div className="form-group">
                                <label className="form-label">Người liên hệ</label>
                                <input 
                                  className="form-input" 
                                  placeholder="Họ và tên"
                                  value={formData.contact_name || ''}
                                  onChange={e => setFormData({...formData, contact_name: e.target.value})}
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Chức vụ</label>
                                <input 
                                  className="form-input" 
                                  placeholder="Ví dụ: GĐ Kinh doanh..."
                                  value={formData.contact_position || ''}
                                  onChange={e => setFormData({...formData, contact_position: e.target.value})}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div className="form-group">
                                <label className="form-label">Số điện thoại</label>
                                <input 
                                  className="form-input" 
                                  placeholder="09xx..."
                                  value={formData.phone || ''}
                                  onChange={e => setFormData({...formData, phone: e.target.value})}
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
                              />
                            </div>

                            <div className="form-group">
                              <AddressSelect
                                label="Địa chỉ văn phòng"
                                value={formData.address || ''}
                                onChange={val => setFormData({...formData, address: val})}
                                placeholder="Chọn địa chỉ văn phòng..."
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Section: Typical Projects & Notes */}
                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '20px', textAlign: 'left' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px', marginBottom: '16px' }}>
                        Dự án tiêu biểu & Ghi chú
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', fontSize: '0.78rem' }}>Dự án tiêu biểu</label>
                          
                          {isReadOnly ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {selectedProjects.length > 0 ? (
                                selectedProjects.map((p, idx) => {
                                  const pId = projectsList.find(proj => proj.name.trim().toLowerCase() === p.trim().toLowerCase())?.id;
                                  return (
                                    <span 
                                      key={idx} 
                                      onClick={() => {
                                        if (pId) {
                                          window.location.href = `/projects?project_id=${pId}`;
                                        } else {
                                          window.location.href = `/projects?search=${encodeURIComponent(p)}`;
                                        }
                                      }}
                                      className="hover-lift"
                                      style={{ 
                                        background: 'rgba(163, 20, 34, 0.04)', 
                                        color: 'var(--color-primary)', 
                                        border: '1px solid rgba(163, 20, 34, 0.15)', 
                                        padding: '4px 10px', 
                                        borderRadius: '6px', 
                                        fontSize: '0.8rem', 
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                      title="Nhấp để xem chi tiết dự án"
                                    >
                                      {p} <ExternalLink size={11} />
                                    </span>
                                  );
                                })
                              ) : (
                                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Không có dự án tiêu biểu.</span>
                              )}
                            </div>
                          ) : (
                            <div style={{ position: 'relative' }}>
                              <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '6px',
                                minHeight: '38px',
                                padding: '6px 12px',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '8px',
                                alignItems: 'center',
                                cursor: 'text'
                              }}
                              onClick={() => setShowProjDropdown(true)}
                              >
                                {selectedProjects.map((p, idx) => (
                                  <span 
                                    key={idx} 
                                    style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      background: 'rgba(163, 20, 34, 0.05)', 
                                      color: 'var(--color-primary)', 
                                      border: '1px solid rgba(163, 20, 34, 0.12)', 
                                      padding: '2px 8px', 
                                      borderRadius: '6px', 
                                      fontSize: '0.78rem', 
                                      fontWeight: 700 
                                    }}
                                  >
                                    {p}
                                    <X 
                                      size={12} 
                                      style={{ cursor: 'pointer', opacity: 0.7 }} 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveProject(p);
                                      }} 
                                    />
                                  </span>
                                ))}
                                
                                <input
                                  type="text"
                                  value={projSearch}
                                  onChange={(e) => {
                                    setProjSearch(e.target.value);
                                    setShowProjDropdown(true);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (projSearch.trim()) {
                                        handleAddProject(projSearch);
                                      }
                                    }
                                  }}
                                  placeholder={selectedProjects.length === 0 ? "Chọn dự án hoặc tự nhập tay..." : ""}
                                  style={{
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    flex: 1,
                                    minWidth: '120px',
                                    fontSize: '0.825rem',
                                    color: 'var(--color-text)',
                                    padding: 0
                                  }}
                                />
                              </div>

                              {showProjDropdown && projSearch.trim() === '' && (
                                <>
                                  <div style={{ position: 'fixed', inset: 0, zIndex: 12000 }} onClick={() => setShowProjDropdown(false)} />
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '8px',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 12001,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    marginTop: '4px'
                                  }}>
                                    {projectsList
                                      .filter(proj => !selectedProjects.includes(proj.name))
                                      .map((proj) => (
                                        <div
                                          key={proj.id}
                                          onClick={() => handleAddProject(proj.name)}
                                          style={{
                                            padding: '8px 12px',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            fontWeight: 550,
                                            color: 'var(--color-text)',
                                            textAlign: 'left'
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-light)'}
                                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                          {proj.name}
                                        </div>
                                      ))}
                                    {projectsList.filter(proj => !selectedProjects.includes(proj.name)).length === 0 && (
                                      <div style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
                                        Gõ để tạo dự án mới...
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              {showProjDropdown && projSearch.trim() !== '' && (
                                <>
                                  <div style={{ position: 'fixed', inset: 0, zIndex: 12000 }} onClick={() => setShowProjDropdown(false)} />
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '8px',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 12001,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    marginTop: '4px'
                                  }}>
                                    {projectsList
                                      .filter(proj => proj.name.toLowerCase().includes(projSearch.toLowerCase()) && !selectedProjects.includes(proj.name))
                                      .map((proj) => (
                                        <div
                                          key={proj.id}
                                          onClick={() => handleAddProject(proj.name)}
                                          style={{
                                            padding: '8px 12px',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            fontWeight: 550,
                                            color: 'var(--color-text)',
                                            textAlign: 'left'
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-light)'}
                                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                          {proj.name}
                                        </div>
                                      ))}
                                    <div
                                      onClick={() => handleAddProject(projSearch)}
                                      style={{
                                        padding: '8px 12px',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        fontWeight: 650,
                                        color: 'var(--color-primary)',
                                        borderTop: '1px solid var(--color-border-light)',
                                        textAlign: 'left'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(163, 20, 34, 0.04)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      + Tạo dự án mới: "{projSearch}"
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', fontSize: '0.78rem' }}>Ghi chú thêm</label>
                          {isReadOnly ? (
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                              {formData.notes || 'Không có ghi chú thêm.'}
                            </div>
                          ) : (
                            <textarea 
                              className="form-textarea" 
                              placeholder="Thông tin thêm về chủ đầu tư..."
                              value={formData.notes || ''}
                              onChange={e => setFormData({...formData, notes: e.target.value})}
                              rows={4}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </>
            )}
          </AnimatePresence>
        , document.body)}
    </div>
  );
};
