import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Truck, Plus, Search, MoreHorizontal, Mail, Phone, MapPin, 
  Trash2, Pencil, ExternalLink, Filter, Download, User, Hash,
  ArrowUpRight
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
    name: '', contact_name: '', email: '', phone: '', address: '', tax_code: '', notes: ''
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
    setFormData(s || { name: '', contact_name: '', email: '', phone: '', address: '', tax_code: '', notes: '' });
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
                className="card hover-lift p-4 relative overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="avatar-placeholder" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: '50%' }}>
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight">{s.name}</h3>
                      <p className="text-xs text-light flex items-center gap-1 mt-1"><User size={12} /> {s.contact_name || 'Chưa có thông tin'}</p>
                    </div>
                  </div>
                  <button className="btn-icon sm"><MoreHorizontal size={16} /></button>
                </div>

                <div className="space-y-2.5 mb-5">
                  <div className="flex items-center gap-2 text-sm text-light">
                    <Phone size={14} className="opacity-50" /> <span>{s.phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-light">
                    <Mail size={14} className="opacity-50" /> <span className="truncate">{s.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-light">
                    <MapPin size={14} className="opacity-50" /> <span className="truncate">{s.address || '—'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border-light)]">
                  <div>
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-wider">Tổng giá trị giao dịch</p>
                    <p className="font-bold text-primary text-base">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(s.total_ordered || 0)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-icon sm" onClick={() => handleOpenModal(s)}><Pencil size={14} /></button>
                    <button className="btn-icon sm text-danger" onClick={() => handleDelete(s.id)}><Trash2 size={14} /></button>
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
              className="modal-sheet modal-md shadow-2xl"
              style={{ maxWidth: '600px', width: '100%' }}
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
                <div className="modal-body">
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
                      <label className="form-label">Người liên hệ</label>
                      <input 
                        className="form-input" 
                        placeholder="Họ và tên"
                        value={formData.contact_name}
                        onChange={e => setFormData({...formData, contact_name: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mã số thuế</label>
                      <input 
                        className="form-input" 
                        placeholder="MST doanh nghiệp"
                        value={formData.tax_code}
                        onChange={e => setFormData({...formData, tax_code: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">Số điện thoại</label>
                      <input 
                        className="form-input" 
                        placeholder="09xx..."
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input 
                        className="form-input" 
                        type="email"
                        placeholder="developer@email.com"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <AddressSelect
                      label="Địa chỉ"
                      value={formData.address}
                      onChange={val => setFormData({...formData, address: val})}
                      placeholder="Chọn địa chỉ chủ đầu tư..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ghi chú thêm</label>
                    <textarea 
                      className="form-textarea" 
                      placeholder="Thông tin thêm về chủ đầu tư..."
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
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
