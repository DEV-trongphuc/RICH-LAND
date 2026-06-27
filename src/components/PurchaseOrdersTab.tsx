import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, Plus, Search, Filter, Calendar, 
  ChevronRight, ArrowUpRight, CheckCircle2, Clock, XCircle, Loader2,
  Truck, Package, Trash2, PlusCircle, MinusCircle, AlertCircle,
  DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { EmptyCard } from '../components/ui/EmptyCard';
import { CustomSelect } from '../components/ui/CustomSelect';

interface Props {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
}

export const PurchaseOrdersTab: React.FC<Props> = ({ showModal, setShowModal }) => {
  console.log('PurchaseOrdersTab RENDERED. showModal =', showModal);
  
  const { addToast, showConfirm } = useUIStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    supplier_id: '', order_date: new Date().toISOString().split('T')[0], notes: '', items: [] as any[]
  });

  const fetchOrders = async () => {
    try {
      const res = await api.get('/purchase-orders');
      setOrders(res.data.data || []);
    } catch (err) {
      addToast('Lỗi khi tải danh sách đơn nhập hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliersAndProducts = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products')
      ]);
      const sData = sRes.data.data;
      const pData = pRes.data.data;
      setSuppliers(Array.isArray(sData) ? sData : (sData?.items || []));
      setProducts(Array.isArray(pData) ? pData : (pData?.items || []));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { 
    fetchOrders(); 
    fetchSuppliersAndProducts();
  }, []);

  const handleAddItem = (p: any) => {
    const cost = Number(p.cost || 0);
    const exists = formData.items.find(i => i.product_id === p.id);
    if (exists) {
      setFormData({
        ...formData,
        items: formData.items.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * Number(i.unit_cost) } : i)
      });
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, { 
          product_id: p.id, 
          name: p.name, 
          quantity: 1, 
          unit_cost: cost, 
          subtotal: cost 
        }]
      });
    }
  };

  const handleRemoveItem = (id: number) => {
    setFormData({ ...formData, items: formData.items.filter((_, idx) => idx !== id) });
  };

  const handleQtyChange = (idx: number, qty: number) => {
    if (qty < 1) return;
    setFormData({
      ...formData,
      items: formData.items.map((item, i) => i === idx ? { ...item, quantity: qty, subtotal: qty * Number(item.unit_cost) } : item)
    });
  };

  const calculateTotal = () => formData.items.reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier_id) return addToast('Vui lòng chọn nhà cung cấp', 'error');
    if (formData.items.length === 0) return addToast('Vui lòng thêm ít nhất một sản phẩm', 'error');
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await api.post('/purchase-orders', {
        ...formData,
        total: calculateTotal(),
        subtotal: calculateTotal()
      });
      addToast('Đã tạo đơn nhập hàng mới', 'success');
      setShowModal(false);
      setFormData({ supplier_id: '', order_date: new Date().toISOString().split('T')[0], notes: '', items: [] });
      fetchOrders();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu đơn hàng', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceive = (id: number) => {
    if (isSubmitting) return;
    showConfirm({
      title: 'Nhập kho hàng hóa',
      message: 'Hệ thống sẽ cộng số lượng sản phẩm vào kho và ghi nhận công nợ. Bạn xác nhận đã nhận đủ hàng?',
      confirmText: 'Xác nhận nhập kho',
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          await api.post(`/purchase-orders/${id}/receive`);
          addToast('Đã nhập kho thành công', 'success');
          fetchOrders();
        } catch (err: any) {
          addToast(err.response?.data?.message || 'Lỗi khi nhập kho', 'error');
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="animate-fade">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner sm"></div>
          </div>
        ) : orders.length === 0 ? (
          <EmptyCard 
            icon={<ShoppingCart size={48} />}
            title="Chưa có đơn nhập hàng nào"
            description="Bắt đầu tạo đơn nhập hàng để quản lý kho và công nợ nhà cung cấp."
            actionText="Tạo đơn đầu tiên"
            onAction={() => setShowModal(true)}
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>MÃ ĐƠN</th>
                    <th>NHÀ CUNG CẤP</th>
                    <th>NGÀY ĐẶT</th>
                    <th style={{ textAlign: 'right' }}>TỔNG TIỀN</th>
                    <th>TRẠNG THÁI</th>
                    <th style={{ textAlign: 'right' }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const statusClass = o.status === 'received' ? 'success' : o.status === 'ordered' ? 'warning' : 'info';
                    const statusLabel = o.status === 'received' ? 'Đã nhập kho' : o.status === 'ordered' ? 'Đã đặt hàng' : 'Nháp';
                    return (
                      <tr key={o.id} className="table-row-hover group">
                        <td>
                          <span className="font-black text-primary text-xs font-mono bg-primary/5 px-2 py-1 rounded">{o.po_number}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Truck size={16} />
                            </div>
                            <span className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>{o.supplier_name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                            <Calendar size={14} style={{ color: 'var(--color-text-light)' }} /> {new Date(o.order_date).toLocaleDateString('vi-VN')}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="font-black text-sm text-primary">
                            {new Intl.NumberFormat('vi-VN').format(o.total)} đ
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${statusClass}`}>{statusLabel}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {o.status === 'ordered' && (
                            <button className="btn primary sm inline-flex items-center justify-center gap-2" onClick={() => handleReceive(o.id)}>
                              <Package size={14} /> Nhập kho
                            </button>
                          )}
                          {o.status === 'received' && (
                            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-success">
                              <CheckCircle2 size={14} /> Hoàn tất
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && ReactDOM.createPortal(
        <div className="overlay-backdrop" onClick={() => setShowModal(false)} style={{ zIndex: 9999 }}>
            <motion.div 
              className="modal-sheet modal-xl shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2 }}
              style={{ height: '90vh', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="modal-header" style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--color-border-light)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <ShoppingCart size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Tạo đơn nhập hàng mới</h3>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>
                      Bước 1: Thiết lập & Chọn sản phẩm
                    </p>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setShowModal(false)} style={{ width: '40px', height: '40px', borderRadius: '12px' }}>
                  <XCircle size={22} />
                </button>
              </div>

              {/* Body: 2 Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, backgroundColor: 'var(--color-bg)' }}>
                
                {/* Left Column: Form & Selected Items */}
                <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRight: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                  <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* Settings Form */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Truck size={14} /> Nhà cung cấp <span className="text-danger">*</span>
                        </label>
                        <CustomSelect 
                          options={suppliers.map(s => ({ value: String(s.id), label: s.name }))}
                          value={formData.supplier_id} 
                          onChange={val => setFormData({...formData, supplier_id: String(val)})}
                          placeholder="-- Chọn nhà cung cấp --"
                          searchable
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} /> Ngày dự kiến
                        </label>
                        <input 
                          type="date" 
                          className="form-input"
                          style={{ height: '3rem', fontWeight: 600, borderRadius: '12px' }}
                          value={formData.order_date} 
                          onChange={e => setFormData({...formData, order_date: e.target.value})} 
                        />
                      </div>
                    </div>

                    {/* Selected Products */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="flex items-center justify-between">
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', margin: 0 }}>
                          Danh sách sản phẩm ({formData.items.length})
                        </label>
                      </div>
                      
                      {formData.items.length === 0 ? (
                        <div style={{ padding: '3rem', border: '2px dashed var(--color-border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg)' }}>
                          <Package size={48} style={{ color: 'var(--color-text-muted)', opacity: 0.3, marginBottom: '1rem' }} />
                          <p style={{ fontWeight: 700, color: 'var(--color-text-light)' }}>Chưa có sản phẩm nào</p>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Chọn sản phẩm từ danh mục bên phải để thêm vào đơn hàng</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {formData.items.map((item, idx) => (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              key={idx} 
                              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg)', borderRadius: '16px', border: '1px solid var(--color-border)' }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>{new Intl.NumberFormat('vi-VN').format(item.unit_cost)} đ</p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-surface)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                                <button type="button" className="btn-icon sm" style={{ border: 'none', background: 'transparent' }} onClick={() => handleQtyChange(idx, item.quantity - 1)}>
                                  <MinusCircle size={16} />
                                </button>
                                <span style={{ width: '24px', textAlign: 'center', fontWeight: 700, fontSize: '0.875rem' }}>{item.quantity}</span>
                                <button type="button" className="btn-icon sm" style={{ border: 'none', background: 'transparent' }} onClick={() => handleQtyChange(idx, item.quantity + 1)}>
                                  <PlusCircle size={16} />
                                </button>
                              </div>
                              <div style={{ width: '120px', textAlign: 'right', fontWeight: 800, color: 'var(--color-text)' }}>
                                {new Intl.NumberFormat('vi-VN').format(item.subtotal)} đ
                              </div>
                              <button type="button" className="btn-icon" style={{ color: 'var(--color-danger)', border: 'none', background: 'transparent' }} onClick={() => handleRemoveItem(idx)}>
                                <Trash2 size={18} />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Summary Box */}
                  <div style={{ marginTop: 'auto', padding: '2rem', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ padding: '1.5rem 2rem', backgroundColor: '#0f172a', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={24} style={{ color: '#38bdf8' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tổng thanh toán</p>
                          <p style={{ fontSize: '1.5rem', fontWeight: 900 }}>{new Intl.NumberFormat('vi-VN').format(calculateTotal())} đ</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                         <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hình thức</p>
                         <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#38bdf8' }}>Công nợ / Tiền mặt</p>
                         <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)' }}>Công nợ / Tiền mặt</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Search & Add Products */}
                <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)' }}>
                  <div style={{ padding: '2rem 1.5rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                    <div className="filter-search w-full" style={{ background: 'var(--color-bg)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                      <Search size={18} className="text-muted" />
                      <input 
                        placeholder="Tìm theo tên hoặc SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ fontSize: '0.875rem', fontWeight: 600 }}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', marginBottom: '1rem', paddingLeft: '0.5rem' }}>
                      Danh mục ({filteredProducts.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {filteredProducts.map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => handleAddItem(p)} 
                          style={{ 
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                            padding: '1rem', borderRadius: '16px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', backgroundColor: 'var(--color-bg)', color: 'var(--color-text-light)', borderRadius: '4px' }}>{p.sku || 'N/A'}</span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tồn: {p.stock_quantity}</span>
                            </div>
                          </div>
                          <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)', transition: 'all 0.2s' }}>
                            <Plus size={16} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{ padding: '1.25rem 2rem', backgroundColor: 'var(--color-surface)', zIndex: 10 }}>
                {suppliers.length === 0 || products.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-warning-light)', padding: '1rem 1.5rem', borderRadius: '16px', border: '1px solid var(--color-warning)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <AlertCircle style={{ color: 'var(--color-warning)' }} size={24} />
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-warning)' }}>Dữ liệu chưa sẵn sàng</p>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Bạn cần khởi tạo {suppliers.length === 0 ? 'nhà cung cấp' : 'sản phẩm'} trước.</p>
                      </div>
                    </div>
                    <button className="btn primary" onClick={() => navigate(suppliers.length === 0 ? '/suppliers' : '/products')}>Khởi tạo ngay</button>
                  </div>
                ) : (
                  <>
                    <button className="btn secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>Hủy bỏ</button>
                    <button className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 2rem' }} onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 size={18} className="spin" /> : 'Xác nhận nhập hàng'}
                      {!isSubmitting && <ArrowUpRight size={18} />}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </>
  );
};
