import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Trash2, CheckCircle2, Package, Plus, X, User, 
  DollarSign, Loader2, FileText, Ban, Receipt, Check, Sparkles
} from 'lucide-react';
import api from '../../api/axios';
import { useUIStore } from '../../store/uiStore';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from './Avatar';
import { numberToText } from '../../utils/numberToText';

interface Product {
  id: number;
  name: string;
  price: number;
  category_id?: number;
  stock_quantity: number;
  track_inventory: number;
  sku?: string;
}

interface Contact {
  id: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
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
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [shippingCustomerPay, setShippingCustomerPay] = useState(true);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'property' | 'other'>('all');

  useEffect(() => {
    api.get('/products', { params: { limit: 15 } })
      .then(r => setPopularProducts(r.data.data?.items || []))
      .catch(() => {});
  }, []);

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

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const finalTotal = totalAmount + (shippingCustomerPay ? shippingFee : 0);

  const FMT_PRICE = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';

  const addToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      const currentQty = existing ? existing.quantity : 0;
      
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="modal-overlay" 
      onClick={onClose} 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 2000000, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backdropFilter: 'blur(8px)', 
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        padding: '1rem'
      }}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
        style={{ 
          maxWidth: '1140px', 
          width: '95vw', 
          height: '88vh', 
          maxHeight: '840px', 
          background: 'var(--color-surface)', 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden', 
          borderRadius: '24px', 
          border: '1px solid var(--color-border-light)', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)' 
        }} 
        onClick={e => e.stopPropagation()}
      >
        <fieldset disabled={isViewer} style={{ border: 'none', padding: 0, margin: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Unified Top Header Bar */}
          <div style={{ 
            padding: '1.25rem 1.75rem', 
            borderBottom: '1px solid var(--color-border-light)', 
            background: 'var(--color-surface)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ 
                background: 'rgba(201, 24, 43, 0.08)', 
                color: 'var(--color-primary)', 
                width: 44, 
                height: 44, 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1px solid rgba(201, 24, 43, 0.15)'
              }}>
                <Receipt size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1.2 }}>Lập Hóa Đơn / Phiếu Thu</h2>
                <p style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)', margin: '3px 0 0 0', fontWeight: 500 }}>
                  Quản lý hóa đơn & dòng tiền giao dịch bất động sản
                </p>
              </div>
            </div>
            <button 
              type="button"
              className="btn-icon" 
              onClick={onClose} 
              style={{ borderRadius: '10px', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Body Split: Left Products (60%) | Right Checkout (40%) */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            
            {/* Left: Product Selection */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', borderRight: '1px solid var(--color-border-light)' }}>
              
              {/* Search Product Bar */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-bg)' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    borderRadius: '12px', 
                    padding: '10px 14px', 
                    background: 'var(--color-surface)', 
                    border: '1px solid var(--color-border)', 
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)' 
                  }}>
                    <Search size={18} style={{ color: 'var(--color-text-muted)', marginRight: '10px' }} />
                    <input 
                      autoFocus 
                      style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text)' }} 
                      placeholder="Tìm kiếm sản phẩm dự án, căn hộ, gói dịch vụ..." 
                      value={searchProduct} 
                      onChange={e => setSearchProduct(e.target.value)} 
                    />
                    {searchProduct && (
                      <button type="button" onClick={() => setSearchProduct('')} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0 }}>
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown search results */}
                  <AnimatePresence>
                    {searchProduct && (
                      <motion.div 
                        initial={{ opacity: 0, y: 6 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0 }} 
                        style={{ 
                          position: 'absolute', 
                          top: '100%', 
                          left: 0, 
                          right: 0, 
                          zIndex: 100, 
                          marginTop: '6px',
                          background: 'var(--color-surface)', 
                          borderRadius: '14px', 
                          border: '1px solid var(--color-border)', 
                          boxShadow: '0 12px 24px -6px rgba(0,0,0,0.15)',
                          padding: '6px',
                          maxHeight: '260px',
                          overflowY: 'auto'
                        }}
                      >
                        {filteredProducts.length > 0 ? filteredProducts.map(p => (
                          <div 
                            key={p.id} 
                            style={{ 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '10px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease'
                            }} 
                            className="hover-lift"
                            onClick={() => addToCart(p)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: 34, height: 34, background: 'var(--color-bg)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package size={16} style={{ color: 'var(--color-text-muted)' }} />
                              </div>
                              <div>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', margin: 0 }}>{p.name}</p>
                                <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                  Mã: {p.sku || p.id} {p.track_inventory ? `• Kho: ${p.stock_quantity || 0}` : ''}
                                </p>
                              </div>
                            </div>
                            <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.9rem' }}>{FMT_PRICE(p.price)}</span>
                          </div>
                        )) : (
                          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.825rem' }}>
                            Không tìm thấy sản phẩm phù hợp
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Product Grid Area */}
              <div style={{ padding: '1.25rem 1.5rem', flex: 1, overflowY: 'auto', background: 'var(--color-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Sản phẩm & Dịch vụ dự án
                  </h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      type="button" 
                      onClick={() => setCategoryFilter('all')}
                      style={{ 
                        padding: '4px 10px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        border: 'none', 
                        cursor: 'pointer',
                        background: categoryFilter === 'all' ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: categoryFilter === 'all' ? 'white' : 'var(--color-text-muted)'
                      }}
                    >
                      Tất cả
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setCategoryFilter('property')}
                      style={{ 
                        padding: '4px 10px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        border: 'none', 
                        cursor: 'pointer',
                        background: categoryFilter === 'property' ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: categoryFilter === 'property' ? 'white' : 'var(--color-text-muted)'
                      }}
                    >
                      Căn hộ / Đất nền
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setCategoryFilter('other')}
                      style={{ 
                        padding: '4px 10px', 
                        borderRadius: '8px', 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        border: 'none', 
                        cursor: 'pointer',
                        background: categoryFilter === 'other' ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: categoryFilter === 'other' ? 'white' : 'var(--color-text-muted)'
                      }}
                    >
                      Ký gửi / Khác
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {(searchProduct ? filteredProducts : popularProducts).map(p => (
                    <motion.div 
                      whileHover={{ y: -3, boxShadow: '0 8px 16px rgba(0,0,0,0.06)' }}
                      whileTap={{ scale: 0.98 }}
                      key={p.id} 
                      className="card cursor-pointer" 
                      style={{ 
                        borderRadius: '14px', 
                        border: '1px solid var(--color-border-light)', 
                        background: 'var(--color-bg)', 
                        padding: '1rem', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease'
                      }} 
                      onClick={() => addToCart(p)}
                    >
                      <div>
                        <div style={{ width: 34, height: 34, background: 'var(--color-surface)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', border: '1px solid var(--color-border-light)' }}>
                          <Package size={16} style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', minHeight: '2.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3, margin: 0 }}>
                          {p.name}
                        </p>
                        {!!p.track_inventory && (
                          <p style={{ fontSize: '0.7rem', color: (p.stock_quantity || 0) <= 5 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: 600, marginTop: '4px', margin: 0 }}>
                            Tồn kho: {p.stock_quantity || 0}
                          </p>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px dashed var(--color-border-light)', marginTop: '0.75rem' }}>
                        <span style={{ color: 'var(--color-text)', fontWeight: 800, fontSize: '0.95rem' }}>{FMT_PRICE(p.price)}</span>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(201, 24, 43, 0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={15} strokeWidth={2.5} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Cart & Customer Panel */}
            <div style={{ width: '400px', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
              
              {/* Customer Selector Block */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-surface)' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', margin: 0 }}>
                  Thông tin khách hàng
                </h3>

                {selectedContact ? (
                  <div style={{ 
                    padding: '0.875rem 1rem', 
                    borderRadius: '14px', 
                    background: 'var(--color-bg)', 
                    border: '1px solid var(--color-border-light)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar name={`${selectedContact.last_name || ''} ${selectedContact.first_name || ''}`} src={selectedContact.avatar_url} size={36} />
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', margin: 0 }}>
                          {selectedContact.last_name || ''} {selectedContact.first_name || 'Khách lẻ'}
                        </p>
                        <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: 0 }}>{selectedContact.phone || 'Chưa có SĐT'}</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className="btn-icon sm" 
                      onClick={() => setSelectedContact(null)} 
                      style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div style={{ 
                        borderRadius: '12px', 
                        background: 'var(--color-bg)', 
                        flex: 1, 
                        border: '1px solid var(--color-border)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '0 10px' 
                      }}>
                        <User size={16} style={{ color: 'var(--color-text-muted)', marginRight: '6px' }} />
                        <input 
                          style={{ background: 'transparent', border: 'none', fontSize: '0.825rem', outline: 'none', width: '100%', height: '38px', color: 'var(--color-text)' }} 
                          placeholder="Tìm & chọn khách hàng..." 
                          value={searchContact} 
                          onChange={e => setSearchContact(e.target.value)} 
                        />
                      </div>
                      <button 
                        type="button"
                        className="btn primary sm" 
                        onClick={() => setShowQuickAdd(true)} 
                        style={{ borderRadius: '12px', width: 38, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <Plus size={18} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {showQuickAdd && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ padding: '1rem', marginTop: '8px', borderRadius: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>Thêm khách hàng nhanh</span>
                            <button type="button" onClick={() => setShowQuickAdd(false)} style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input className="form-input sm" placeholder="Họ" value={newCust.last_name} onChange={e => setNewCust(prev => ({ ...prev, last_name: e.target.value }))} />
                            <input className="form-input sm" placeholder="Tên *" value={newCust.first_name} onChange={e => setNewCust(prev => ({ ...prev, first_name: e.target.value }))} />
                            <input className="form-input sm" placeholder="Số điện thoại *" value={newCust.phone} onChange={e => setNewCust(prev => ({ ...prev, phone: e.target.value }))} />
                            <button type="button" className="btn primary sm" style={{ width: '100%', marginTop: '4px' }} onClick={handleQuickAdd} disabled={loading}>Lưu & Chọn</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {searchContact && (
                      <div style={{ marginTop: '4px', padding: '4px', position: 'absolute', width: '100%', zIndex: 10, borderRadius: '12px', top: '42px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                        {filteredContacts.length > 0 ? filteredContacts.map(c => (
                          <div 
                            key={c.id} 
                            className="hover-bg cursor-pointer" 
                            style={{ padding: '0.625rem 0.75rem', borderRadius: '8px' }} 
                            onClick={() => { setSelectedContact(c); setSearchContact(''); }}
                          >
                            <p style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--color-text)', margin: 0 }}>{c.last_name} {c.first_name}</p>
                            <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: 0 }}>{c.phone}</p>
                          </div>
                        )) : (
                          <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Không tìm thấy khách hàng
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart List Block */}
              <div style={{ padding: '1.25rem 1.5rem', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Chi tiết giao dịch
                  </h3>
                  <span className="badge info" style={{ borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                    {cart.length} hạng mục
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {cart.map((item) => (
                    <motion.div 
                      layout 
                      key={item.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        background: 'var(--color-surface)', 
                        padding: '0.75rem 0.875rem', 
                        borderRadius: '12px', 
                        border: '1px solid var(--color-border-light)'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                        <p style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 800, margin: '2px 0 0 0' }}>
                          {FMT_PRICE(item.price)}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg)', padding: '2px 4px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                          <button 
                            type="button"
                            className="btn ghost sm" 
                            style={{ padding: 0, width: 22, height: 22, borderRadius: '6px', minWidth: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                            onClick={() => {
                              setCart(prev => prev.map(x => x.id === item.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x));
                            }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                          <button 
                            type="button"
                            className="btn ghost sm" 
                            style={{ padding: 0, width: 22, height: 22, borderRadius: '6px', minWidth: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                            onClick={() => {
                              if (item.track_inventory && item.quantity >= item.stock_quantity) {
                                addToast('Không thể vượt quá số lượng tồn kho', 'warning');
                                return;
                              }
                              setCart(prev => prev.map(x => x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x));
                            }}
                          >
                            +
                          </button>
                        </div>
                        <button 
                          type="button"
                          style={{ color: 'var(--color-danger)', padding: '4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }} 
                          className="hover-bg" 
                          onClick={() => {
                            setCart(prev => prev.filter(x => x.id !== item.id));
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {cart.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 0', color: 'var(--color-text-muted)' }}>
                      <FileText size={36} strokeWidth={1.2} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                      <p style={{ fontSize: '0.825rem', fontWeight: 600, margin: 0, opacity: 0.6 }}>Chưa chọn sản phẩm giao dịch</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary & Checkout Footer */}
              <div style={{ padding: '1.25rem 1.5rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border-light)' }}>
                
                {/* Shipping Fee */}
                <div style={{ marginBottom: '0.875rem', padding: '0.75rem 0.875rem', background: 'var(--color-bg)', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>CHI PHÍ DỊCH VỤ PHÁT SINH</span>
                    <div style={{ display: 'flex', background: 'var(--color-surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                      <button 
                        type="button"
                        className={`btn sm ${shippingCustomerPay ? 'primary' : 'ghost'}`} 
                        onClick={() => setShippingCustomerPay(true)} 
                        style={{ fontSize: '0.68rem', padding: '2px 6px', height: '20px', borderRadius: '4px' }}
                      >
                        Khách chịu
                      </button>
                      <button 
                        type="button"
                        className={`btn sm ${!shippingCustomerPay ? 'primary' : 'ghost'}`} 
                        onClick={() => setShippingCustomerPay(false)} 
                        style={{ fontSize: '0.68rem', padding: '2px 6px', height: '20px', borderRadius: '4px' }}
                      >
                        Công ty chịu
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', borderRadius: '8px', padding: '4px 8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <DollarSign size={13} style={{ color: 'var(--color-primary)', marginRight: '4px' }} />
                    <input 
                      type="number" 
                      style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)' }} 
                      placeholder="0" 
                      value={shippingFee || ''} 
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        setShippingFee(isNaN(val) ? 0 : val);
                      }} 
                    />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>VND</span>
                  </div>
                  {shippingFee > 0 && (
                    <div style={{ marginTop: '4px', fontSize: '0.68rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
                      {numberToText(shippingFee)}
                    </div>
                  )}
                </div>

                {/* Total Payment */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Tổng tiền thanh toán
                    </span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: '2px' }}>
                      {FMT_PRICE(finalTotal)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} /> Đã bao gồm VAT
                    </span>
                  </div>
                </div>

                {/* Checkout Submit Button */}
                <button 
                  type="button"
                  className="btn primary lg" 
                  disabled={loading || cart.length === 0 || !selectedContact || isViewer}
                  onClick={handleCheckout}
                  style={{ 
                    width: '100%', 
                    padding: '0.875rem', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '6px', 
                    transition: 'all 0.2s ease', 
                    background: isViewer ? 'var(--color-border)' : 'var(--color-primary)', 
                    color: isViewer ? 'var(--color-text-muted)' : 'white', 
                    fontSize: '0.9rem', 
                    fontWeight: 800, 
                    border: 'none', 
                    height: '48px', 
                    boxShadow: isViewer ? 'none' : '0 4px 12px rgba(201, 24, 43, 0.25)' 
                  }}
                >
                  {loading ? <Loader2 size={18} className="spin" /> : (isViewer ? <Ban size={16} /> : <CheckCircle2 size={16} />)}
                  {isViewer ? 'BẠN KHÔNG CÓ QUYỀN XUẤT HÓA ĐƠN' : 'XÁC NHẬN & XUẤT HÓA ĐƠN'}
                </button>
              </div>

            </div>
          </div>
        </fieldset>
      </motion.div>
    </div>,
    document.body
  ) : null;
};
