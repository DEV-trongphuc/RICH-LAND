import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Trash2, CheckCircle2, Package, Plus, X, User, DollarSign, Loader2, Truck, FileText, Ban } from 'lucide-react';
import api from '../../api/axios';
import { useUIStore } from '../../store/uiStore';
import { Tooltip } from './Tooltip';
import { useAuth } from '../../contexts/AuthContext';

interface Product {
  id: number;
  name: string;
  price: number;
  category_id?: number;
  stock_quantity: number;
  track_inventory: number;
  sku?: string;
}

import { numberToText } from '../../utils/numberToText';

interface Contact {
  id: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

interface CartItem extends Product {
  quantity: number;
}

export const POSModal: React.FC<{ onClose: () => void; defaultContact?: Contact | null }> = ({ onClose, defaultContact }) => {
  const { addToast } = useUIStore();
  const { user: currentUser } = useAuth();
  const isViewer = currentUser?.role === 'viewer';
  const [products, setProducts] = useState<Product[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchContact, setSearchContact] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(defaultContact || null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newCust, setNewCust] = useState({ first_name: '', last_name: '', phone: '' });

  const [popularProducts, setPopularProducts] = useState<Product[]>([]);

  // Initial fetch for popular products
  useEffect(() => {
    api.get('/products', { params: { limit: 15 } }).then(r => setPopularProducts(r.data.data?.items || [])).catch(() => {});
  }, []);

  // Search products
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchProduct.trim()) {
        setProducts([]);
        return;
      }
      api.get('/products', { params: { search: searchProduct, limit: 10 } })
        .then(r => setProducts(r.data.data?.items || []))
        .catch(() => setProducts([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchProduct]);

  // Search contacts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchContact.trim()) {
        setContacts([]);
        return;
      }
      api.get('/contacts', { params: { search: searchContact, limit: 10 } })
        .then(r => setContacts(r.data.data?.items || []))
        .catch(() => setContacts([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchContact]);

  const filteredProducts = products;
  const filteredContacts = contacts;

  const addToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      const currentQty = existing ? existing.quantity : 0;
      
      // Check stock if tracking is enabled
      if (p.track_inventory && currentQty >= p.stock_quantity) {
        addToast(`Sản phẩm ${p.name} đã hết hàng trong kho`, 'warning');
        return prev;
      }

      if (existing) {
        return prev.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...p, quantity: 1 }];
    });
    setSearchProduct('');
  };

  const [shippingFee, setShippingFee] = useState(0);
  const [shippingCustomerPay, setShippingCustomerPay] = useState(true);

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const finalTotal = totalAmount + (shippingCustomerPay ? shippingFee : 0);

  const FMT_PRICE = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';

  const handleQuickAdd = async () => {
    if (!newCust.first_name || !newCust.phone) return addToast('Vui lòng nhập tên và SĐT', 'warning');
    setLoading(true);
    try {
      const r = await api.post('/contacts', newCust);
      const created = r.data.data;
      setContacts(prev => [created, ...prev]);
      setSelectedContact(created);
      setShowQuickAdd(false);
      setNewCust({ first_name: '', last_name: '', phone: '' });
      addToast('Đã thêm khách hàng mới', 'success');
    } catch {
      addToast('Lỗi khi thêm khách hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedContact) return addToast('Vui lòng chọn khách hàng', 'warning');
    if (cart.length === 0) return addToast('Giỏ hàng trống', 'warning');

    setLoading(true);
    try {
      await api.post('/pos', {
        customer_id: selectedContact.id,
        cart,
        total_amount: finalTotal,
        shipping_fee: shippingFee,
        shipping_customer_pay: shippingCustomerPay ? 1 : 0
      });
      addToast('Tạo đơn hàng thành công!', 'success');
      onClose();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi tạo đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0, 0, 0, 0.65)' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        style={{ maxWidth: '1200px', width: '95vw', height: '85vh', maxHeight: '850px', background: 'var(--color-surface)', display: 'flex', overflow: 'hidden', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-2xl)' }} 
        onClick={e => e.stopPropagation()}
      >
        <fieldset disabled={isViewer} style={{ border: 'none', padding: 0, margin: 0, width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
          {/* Left: Product Selection */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-surface)' }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'var(--color-primary)', color: 'white', width: 48, height: 48, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px var(--color-primary-light)' }}>
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>Lập Hóa Đơn / Phiếu Thu</h2>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Quản lý hóa đơn & dòng tiền bất động sản
                      <Tooltip content="Mỗi hóa đơn tạo lập sẽ ghi nhận trực tiếp vào doanh thu dự án và liên kết với khách hàng tương ứng." />
                    </p>
                  </div>
                </div>
                <button className="btn ghost sm" onClick={onClose} style={{ borderRadius: '50%', width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: '16px', padding: '12px 18px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <Search size={20} style={{ color: 'var(--color-primary)', marginRight: '12px' }} />
                  <input autoFocus style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-text)' }} placeholder="Tìm kiếm sản phẩm dự án, căn hộ, dịch vụ..." value={searchProduct} onChange={e => setSearchProduct(e.target.value)} />
                </div>

                <AnimatePresence>
                  {searchProduct && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card mt-2 shadow-2xl" style={{ position: 'absolute', width: '100%', zIndex: 100, borderRadius: '20px', left: 0, padding: '0.5rem' }}>
                      {filteredProducts.length > 0 ? filteredProducts.map(p => (
                        <div key={p.id} className="hover-bg cursor-pointer transition-all" style={{ padding: '0.75rem 1rem', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => addToCart(p)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: 40, height: 40, background: 'var(--color-bg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={18} className="text-light" /></div>
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{p.name}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 700 }}>
                               Mã: {p.sku || p.id} {p.track_inventory ? `• Kho: ${p.stock_quantity || 0}` : ''}
                              </p>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: 900, color: 'var(--color-primary)', fontSize: '1rem' }}>{FMT_PRICE(p.price)}</p>
                          </div>
                        </div>
                      )) : <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-light)' }}>Không tìm thấy sản phẩm</div>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div style={{ padding: '2rem', flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sản phẩm & Dịch vụ dự án</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="badge primary" style={{ cursor: 'pointer' }}>Tất cả</span>
                  <span className="badge outline" style={{ cursor: 'pointer' }}>Căn hộ/Đất nền</span>
                  <span className="badge outline" style={{ cursor: 'pointer' }}>Ký gửi/Khác</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {(searchProduct ? filteredProducts : popularProducts).map(p => (
                   <motion.div 
                    whileHover={{ y: -4, boxShadow: 'var(--shadow-lg)' }}
                    whileTap={{ scale: 0.98 }}
                    key={p.id} 
                    className="card cursor-pointer" 
                    style={{ borderRadius: '16px', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', transition: 'all 0.2s', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} 
                    onClick={() => addToCart(p)}
                   >
                     <div>
                      <div style={{ width: 32, height: 32, background: 'var(--color-bg)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                        <Package size={16} color="var(--color-text-muted)" />
                      </div>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', minHeight: '2.4rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>{p.name}</p>
                      {!!p.track_inventory && (
                        <p style={{ fontSize: '0.68rem', color: (p.stock_quantity || 0) <= 5 ? 'var(--color-danger)' : 'var(--color-text-light)', fontWeight: 700, marginTop: '2px' }}>
                          Số lượng: {p.stock_quantity || 0}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)', marginTop: '0.5rem' }}>
                       <p style={{ color: 'var(--color-text)', fontWeight: 800, fontSize: '1.05rem' }}>{FMT_PRICE(p.price)}</p>
                       <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Plus size={16} strokeWidth={3} />
                       </div>
                    </div>
                   </motion.div>
                 ))}
              </div>
            </div>
          </div>

          {/* Right: Cart & Customer */}
          <div style={{ width: 420, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--color-border)' }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Thông tin khách hàng</h3>
              {selectedContact ? (
                <div className="card" style={{ padding: '1rem', borderRadius: '20px', background: 'var(--color-bg)', border: '1px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="avatar-placeholder md" style={{ background: 'var(--color-primary)', borderRadius: '14px', width: 40, height: 40 }}>{selectedContact.first_name?.[0] || '?'}</div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>{selectedContact.first_name || 'Khách'} {selectedContact.last_name || 'hàng'}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{selectedContact.phone || '—'}</p>
                    </div>
                  </div>
                  <button className="btn ghost sm text-danger" onClick={() => setSelectedContact(null)} style={{ padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ borderRadius: '14px', background: 'var(--color-bg)', flex: 1, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                      <User size={18} className="text-light" style={{ marginRight: '8px' }} />
                      <input style={{ background: 'transparent', border: 'none', fontSize: '0.875rem', outline: 'none', width: '100%', height: '42px', color: 'var(--color-text)' }} placeholder="Chọn khách hàng..." value={searchContact} onChange={e => setSearchContact(e.target.value)} />
                    </div>
                    <button className="btn primary sm" onClick={() => setShowQuickAdd(true)} style={{ borderRadius: '14px', width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={20} /></button>
                  </div>

                  <AnimatePresence>
                    {showQuickAdd && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card border-primary" style={{ padding: '1rem', marginBottom: '1rem', borderRadius: '18px', boxShadow: 'var(--shadow-xl)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-primary)' }}>Thêm khách hàng nhanh</span>
                          <button onClick={() => setShowQuickAdd(false)} style={{ color: 'var(--color-text-light)', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <input className="form-input sm" placeholder="Họ" value={newCust.last_name} onChange={e => {
                            const val = e.target.value;
                            setNewCust(prev => ({ ...prev, last_name: val }));
                          }} />
                          <input className="form-input sm" placeholder="Tên *" value={newCust.first_name} onChange={e => {
                            const val = e.target.value;
                            setNewCust(prev => ({ ...prev, first_name: val }));
                          }} />
                          <input className="form-input sm" placeholder="Số điện thoại *" value={newCust.phone} onChange={e => {
                            const val = e.target.value;
                            setNewCust(prev => ({ ...prev, phone: val }));
                          }} />
                          <button className="btn primary sm" style={{ width: '100%', marginTop: '4px' }} onClick={handleQuickAdd} disabled={loading}>Lưu & Chọn</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {searchContact && (
                    <div className="card shadow-2xl" style={{ marginTop: '4px', padding: '4px', position: 'absolute', width: '100%', zIndex: 10, borderRadius: '16px', top: '48px' }}>
                      {filteredContacts.length > 0 ? filteredContacts.map(c => (
                        <div key={c.id} className="hover-bg cursor-pointer" style={{ padding: '0.75rem', borderRadius: '12px' }} onClick={() => { setSelectedContact(c); setSearchContact(''); }}>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{c.first_name} {c.last_name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{c.phone}</p>
                        </div>
                      )) : <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-light)' }}>Không tìm thấy khách hàng</div>}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '1.5rem', flex: 1, overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Chi tiết giao dịch</h3>
                <span className="badge primary" style={{ borderRadius: '6px' }}>{cart.length} hạng mục</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {cart.map((item) => (
                  <motion.div layout key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '0.75rem 1rem', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid transparent', transition: 'all 0.2s' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 900, marginTop: '2px' }}>{FMT_PRICE(item.price)}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--color-bg)', padding: '2px 4px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                        <button className="btn ghost sm" style={{ padding: 0, width: 22, height: 22, borderRadius: '6px', minWidth: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => {
                          setCart(prev => prev.map(x => x.id === item.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x));
                        }}>-</button>
                        <span style={{ fontSize: '0.78rem', fontWeight: 900, width: '16px', textAlign: 'center' }}>{item.quantity}</span>
                        <button className="btn ghost sm" style={{ padding: 0, width: 22, height: 22, borderRadius: '6px', minWidth: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => {
                          if (item.track_inventory && item.quantity >= item.stock_quantity) {
                            addToast('Không thể vượt quá số lượng dự kiến', 'warning');
                            return;
                          }
                          setCart(prev => prev.map(x => x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x));
                        }}>+</button>
                      </div>
                      <button style={{ color: 'var(--color-danger)', padding: '4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }} className="hover-bg" onClick={() => {
                        setCart(prev => prev.filter(x => x.id !== item.id));
                      }}><Trash2 size={14} /></button>
                    </div>
                  </motion.div>
                ))}
                {cart.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: 'var(--color-text-light)', opacity: 0.4 }}>
                    <FileText size={40} strokeWidth={1} style={{ marginBottom: '0.75rem' }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>Chưa chọn sản phẩm giao dịch</p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '1.5rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', borderRadius: '0 0 32px 0' }}>
              {/* Shipping Section */}
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--color-bg)', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-light)' }}>CHI PHÍ DỊCH VỤ PHÁT SINH</span>
                  <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <button className={`btn sm ${shippingCustomerPay ? 'primary' : 'ghost'}`} onClick={() => setShippingCustomerPay(true)} style={{ fontSize: '0.7rem', padding: '2px 6px', height: '20px' }}>Khách chịu</button>
                    <button className={`btn sm ${!shippingCustomerPay ? 'primary' : 'ghost'}`} onClick={() => setShippingCustomerPay(false)} style={{ fontSize: '0.7rem', padding: '2px 6px', height: '20px' }}>Công ty chịu</button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: '10px', padding: '6px 10px', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <DollarSign size={14} style={{ color: 'var(--color-primary)', marginRight: '6px' }} />
                  <input 
                    type="number" 
                    style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }} 
                    placeholder="0" 
                    value={shippingFee || ''} 
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setShippingFee(isNaN(val) ? 0 : val);
                    }} 
                  />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)' }}>VND</span>
                </div>
                {shippingFee > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
                    {numberToText(shippingFee)}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tổng tiền thanh toán</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: '-0.03em', lineHeight: 1, marginTop: '4px' }}>{FMT_PRICE(finalTotal)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}><CheckCircle2 size={12} /> Đã bao gồm VAT</span>
                </div>
              </div>
              <button 
                className="btn primary lg" 
                disabled={loading || cart.length === 0 || !selectedContact || isViewer}
                onClick={handleCheckout}
                style={{ width: '100%', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', background: isViewer ? 'var(--color-border)' : 'linear-gradient(135deg, var(--color-primary) 0%, #8a0f1b 100%)', color: isViewer ? 'var(--color-text-muted)' : 'white', fontSize: '0.95rem', fontWeight: 800, border: 'none', height: '52px', boxShadow: isViewer ? 'none' : 'var(--shadow-lg)' }}
              >
                {loading ? <Loader2 size={20} className="spin" /> : (isViewer ? <Ban size={18} /> : <CheckCircle2 size={18} />)}
                {isViewer ? 'BẠN KHÔNG CÓ QUYỀN XUẤT HÓA ĐƠN' : 'XÁC NHẬN & XUẤT HÓA ĐƠN'}
              </button>
            </div>
          </div>
        </fieldset>
      </motion.div>
    </div>
  );
};
