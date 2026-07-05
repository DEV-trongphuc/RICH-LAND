import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, Plus, Search, MoreHorizontal, Mail, Phone, MapPin, 
  Trash2, Pencil, ExternalLink, Filter, Download, User, Hash,
  ArrowUpRight, Building2
} from 'lucide-react';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { EmptyCard } from '../components/ui/EmptyCard';
import { AddressSelect } from '../components/ui/AddressSelect';
import { Pagination } from '../components/ui/Pagination';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';

export const SuppliersPage: React.FC = () => {
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
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
      
      setSuppliers(list);
      setTotal(list.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/suppliers', { params: { page, limit: 12, search: searchTerm } });
      const data = res.data.data;
      setSuppliers(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      addToast('Lỗi khi tải danh sách chủ đầu tư', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, [page]);

  // Handle search with debounce effect if needed, but for now simple trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) fetchSuppliers();
      else setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleOpenModal = (s: any = null) => {
    setSelectedSupplier(s);
    setFormData(s || {
      name: '', contact_name: '', email: '', phone: '', address: '', tax_code: '', notes: '',
      contact_position: '', website: '', scale_capital: '', typical_projects: '', focused_type: '', prestige_tier: 'A', cooperation_status: 'active', bank_account: ''
    });
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
          <button className="btn primary" onClick={() => handleOpenModal()}>
            <Plus size={18} /> Thêm chủ đầu tư
          </button>
        </div>
      </div>

      <div className="card-panel mb-6">
        <div className="flex items-center gap-4">
          <div className="filter-search flex-1">
            <Search size={18} className="text-muted" />
            <input 
              type="text"
              placeholder="Tìm kiếm theo tên chủ đầu tư hoặc người liên hệ..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn secondary">
            <Filter size={16} /> Bộ lọc nâng cao
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
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '260px',
                  borderRadius: '16px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  boxShadow: 'var(--shadow-sm)'
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.08), rgba(249, 115, 22, 0.08))',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Building2 size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                          {s.name}
                        </h3>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span className="badge sm" style={{ background: '#f3f4f6', color: '#6b7280', fontSize: '0.65rem' }}>
                            Chủ đầu tư
                          </span>
                          {s.prestige_tier && (
                            <span className="badge sm" style={{
                              background: s.prestige_tier === 'A' ? 'rgba(16, 185, 129, 0.1)' : s.prestige_tier === 'B' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                              color: s.prestige_tier === 'A' ? '#10b981' : s.prestige_tier === 'B' ? '#3b82f6' : '#6b7280',
                              fontSize: '0.65rem'
                            }}>
                              Hạng {s.prestige_tier}
                            </span>
                          )}
                          {s.cooperation_status && (
                            <span className="badge sm" style={{
                              background: s.cooperation_status === 'active' ? 'rgba(16, 185, 129, 0.1)' : s.cooperation_status === 'negotiating' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: s.cooperation_status === 'active' ? '#10b981' : s.cooperation_status === 'negotiating' ? '#f59e0b' : '#ef4444',
                              fontSize: '0.65rem'
                            }}>
                              {s.cooperation_status === 'active' ? 'Đang liên kết' : s.cooperation_status === 'negotiating' ? 'Đang đàm phán' : 'Tạm ngưng'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '0.75rem', padding: '0.75rem 0', borderTop: '1px solid var(--color-border-light)' }}>
                    {s.contact_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        <User size={13} style={{ opacity: 0.6 }} />
                        <span style={{ fontWeight: 600 }}>
                          {s.contact_name} {s.contact_position ? `(${s.contact_position})` : ''}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      <Phone size={13} style={{ opacity: 0.6 }} />
                      <span>{s.phone || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                      <Mail size={13} style={{ opacity: 0.6 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                      <MapPin size={13} style={{ opacity: 0.6 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.address || '—'}</span>
                    </div>
                    {s.website && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <ExternalLink size={13} style={{ opacity: 0.6 }} />
                        <a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          {s.website}
                        </a>
                      </div>
                    )}
                    {s.typical_projects && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--color-text-muted)', minWidth: 0 }}>
                        <Building2 size={13} style={{ opacity: 0.6 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }} title={s.typical_projects}>
                          Dự án: {s.typical_projects}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                    <button className="btn ghost sm" onClick={() => handleOpenModal(s)} style={{ padding: '6px', borderRadius: '6px' }}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn ghost sm text-danger" onClick={() => handleDelete(s.id)} style={{ padding: '6px', borderRadius: '6px' }}>
                      <Trash2 size={13} />
                    </button>
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
            <div className="overlay-backdrop" onClick={() => setShowModal(false)} style={{ zIndex: 1000 }}>
              <motion.div 
                className="modal-sheet modal-lg shadow-2xl"
                style={{ maxWidth: '900px', width: '100%' }}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>{selectedSupplier ? 'Cập nhật đối tác' : 'Thêm chủ đầu tư mới'}</h3>
                  <button className="btn-icon sm" onClick={() => setShowModal(false)}><ArrowUpRight size={18} style={{ transform: 'rotate(45deg)' }} /></button>
                </div>

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

                        <div className="grid grid-2">
                          <div className="form-group">
                            <label className="form-label">Phân hạng uy tín</label>
                            <select 
                              className="form-input"
                              value={formData.prestige_tier || 'A'}
                              onChange={e => setFormData({...formData, prestige_tier: e.target.value})}
                            >
                              <option value="A">Hạng A (Rất uy tín)</option>
                              <option value="B">Hạng B (Uy tín)</option>
                              <option value="C">Hạng C (Trung bình)</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Trạng thái hợp tác</label>
                            <select 
                              className="form-input"
                              value={formData.cooperation_status || 'active'}
                              onChange={e => setFormData({...formData, cooperation_status: e.target.value})}
                            >
                              <option value="active">Đang liên kết</option>
                              <option value="negotiating">Đang đàm phán</option>
                              <option value="suspended">Tạm ngưng</option>
                            </select>
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

                        <div className="grid grid-2">
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
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      , document.body)}
    </div>
  );
};
