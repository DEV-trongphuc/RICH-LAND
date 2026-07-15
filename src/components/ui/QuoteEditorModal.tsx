import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Search, Trash2, CheckCircle2, Package, Plus, X, 
  User, DollarSign, Loader2, Calendar, FileType, ChevronDown, 
  Tag, Percent, Calculator, Info, ShoppingCart, ArrowRight, TrendingUp
} from 'lucide-react';
import api from '../../api/axios';
import { useUIStore } from '../../store/uiStore';
import { numberToText } from '../../utils/numberToText';
import { useAuth } from '../../contexts/AuthContext';

interface Product {
  id: number;
  name: string;
  price: number;
  sku?: string;
  description?: string;
}

interface Contact {
  id: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  company_name?: string;
}

interface QuoteItem {
  product_id?: number;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount: number; // percent
  subtotal: number;
}

interface QuoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  quote?: any; // If editing
  onSuccess: () => void;
  initialContact?: Contact | null;
  isViewer?: boolean;
  onEdit?: () => void;
}

export const QuoteEditorModal: React.FC<QuoteEditorProps> = ({ 
  isOpen, onClose, quote, onSuccess, initialContact, isViewer: isViewerProp, onEdit
}) => {
  const { addToast } = useUIStore();
  const { user: currentUser } = useAuth();
  const isViewer = isViewerProp || currentUser?.role === 'viewer';
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const [form, setForm] = useState({
    title: '',
    contact_id: null as number | null,
    deal_id: null as number | null,
    valid_until: '',
    status: 'draft',
    notes: '',
    terms: '',
    discount: 0, // overall discount amount
    tax_rate: 10, // VAT 10%
  });

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [searchContact, setSearchContact] = useState('');
  const [showContactResults, setShowContactResults] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(initialContact || null);
  const contactSearchRef = React.useRef<HTMLDivElement>(null);
  const productSearchRef = React.useRef<HTMLDivElement>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [showDealPicker, setShowDealPicker] = useState(false);
  const [searchDeal, setSearchDeal] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contactSearchRef.current && !contactSearchRef.current.contains(event.target as Node)) {
        setShowContactResults(false);
      }
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      api.get('/products').then(r => setProducts(r.data.data?.items || r.data.data || [])).catch(() => {});
      api.get('/contacts').then(r => setContacts(r.data.data?.items || r.data.data || [])).catch(() => {});
      api.get('/deals').then(r => setDeals(r.data.data?.items || r.data.data || [])).catch(() => {});
      
      if (quote) {
        const qSub = Number(quote.subtotal) || 0;
        const qDisc = Number(quote.discount) || 0;
        const qTax = Number(quote.tax) || 0;
        const base = qSub - qDisc;
        const calculatedTaxRate = base > 0 ? Math.round((qTax / base) * 100) : 10;

        setForm({
          title: quote.title || '',
          contact_id: quote.contact_id || null,
          deal_id: quote.deal_id || null,
          valid_until: quote.valid_until || '',
          status: quote.status || 'draft',
          notes: quote.notes || '',
          terms: quote.terms || '',
          discount: Number(quote.discount) || 0,
          tax_rate: calculatedTaxRate,
        });
        api.get(`/quotes/${quote.id}`).then(r => {
          setItems(r.data.data?.items || []);
          // Note: selectedContact and selectedDeal are handled by separate useEffects
        });
      } else {
        setForm({
          title: '',
          contact_id: initialContact?.id || null,
          deal_id: null,
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'draft',
          notes: '',
          terms: 'Thanh toán 100% sau khi ký báo giá.',
          discount: 0,
          tax_rate: 10,
        });
        setItems([]);
        setSelectedContact(initialContact || null);
      }
    }
  }, [isOpen, quote, initialContact]);

  useEffect(() => {
    if (quote?.contact_id && contacts.length > 0) {
      const c = contacts.find(x => x.id === quote.contact_id);
      if (c) setSelectedContact(c);
    }
  }, [quote, contacts]);

  useEffect(() => {
    if (quote?.deal_id && deals.length > 0) {
      const d = deals.find(x => x.id === quote.deal_id);
      if (d) setSelectedDeal(d);
    }
  }, [quote, deals]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const filteredProducts = useMemo(() => {
    if (!showProductDropdown) return [];
    const prodList = Array.isArray(products) ? products : [];
    if (!searchProduct) return prodList.slice(0, 12);
    return prodList.filter(p => `${p.name} ${p.sku || ''}`.toLowerCase().includes(searchProduct.toLowerCase())).slice(0, 12);
  }, [products, searchProduct, showProductDropdown]);

  const filteredDeals = useMemo(() => {
    const dealList = Array.isArray(deals) ? deals : [];
    if (!searchDeal) return dealList.slice(0, 8);
    return dealList.filter(d => d.title?.toLowerCase().includes(searchDeal.toLowerCase())).slice(0, 8);
  }, [deals, searchDeal]);

  const filteredContacts = useMemo(() => {
    const contactList = Array.isArray(contacts) ? contacts : [];
    if (!searchContact) return [];
    return contactList.filter(c => `${c.first_name} ${c.last_name} ${c.phone} ${c.email}`.toLowerCase().includes(searchContact.toLowerCase())).slice(0, 8);
  }, [contacts, searchContact]);

  const addItem = (p: Product) => {
    const newItem: QuoteItem = {
      product_id: p.id,
      name: p.name,
      description: p.description,
      quantity: 1,
      unit_price: p.price,
      discount: 0,
      subtotal: p.price
    };
    setItems(prev => [...prev, newItem]);
    setSearchProduct('');
    setShowProductDropdown(false);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, fields: Partial<QuoteItem>) => {
    const newItems = [...items];
    const item = { ...newItems[index], ...fields };
    const up = Number(item.unit_price) || 0;
    const qty = Number(item.quantity) || 0;
    const disc = Number(item.discount) || 0;
    item.subtotal = (up * qty) * (1 - (disc / 100));
    newItems[index] = item;
    setItems(newItems);
  };

  const subtotal = items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);
  const taxAmount = (subtotal - (Number(form.discount) || 0)) * ((Number(form.tax_rate) || 0) / 100);
  const total = subtotal - (Number(form.discount) || 0) + taxAmount;

  const handleSave = async () => {
    if (loading) return;
    if (!form.title) return addToast('Vui lòng nhập tiêu đề báo giá', 'warning');
    if (!selectedContact) return addToast('Vui lòng chọn khách hàng', 'warning');
    if (items.length === 0) return addToast('Báo giá phải có ít nhất 1 sản phẩm', 'warning');

    setLoading(true);
    const payload = { ...form, contact_id: selectedContact.id, deal_id: selectedDeal?.id || null, subtotal, tax: taxAmount, total, items };

    try {
      if (quote) {
        await api.put(`/quotes/${quote.id}`, payload);
        addToast('Cập nhật báo giá thành công', 'success');
      } else {
        await api.post('/quotes', payload);
        addToast('Tạo báo giá thành công', 'success');
      }
      onSuccess();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu báo giá', 'error');
    } finally {
      setLoading(false);
    }
  };

  const FMT = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

  if (!isOpen) return null;

  return createPortal(
    <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 9999, overflow: 'hidden', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="modal-sheet"
          style={{ width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none', borderRadius: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 0, background: 'var(--color-bg)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <div className="flex items-center gap-4">
              <div style={{ background: 'var(--color-primary)', color: '#fff', width: 48, height: 48, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(163, 20, 34, 0.25)' }}>
                <FileText size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black">{quote ? 'Chỉnh sửa Báo giá' : 'Tạo Báo giá Mới'}</h2>
                <p className="text-xs text-light font-bold uppercase tracking-widest opacity-70">{quote ? quote.quote_number : 'Bản nháp báo giá chuyên nghiệp'}</p>
              </div>
            </div>
            <button className="btn-icon sm" onClick={onClose}><X size={20} /></button>
          </div>

          <div className="modal-body" style={{ background: 'var(--color-bg)', padding: '1.5rem 2rem 1.5rem', flex: 1, overflowY: 'auto', maxHeight: 'none' }}>
            <fieldset disabled={isViewer} style={{ border: 'none', padding: 0, margin: 0, width: '100%', display: 'contents' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'stretch', minHeight: 'calc(100vh - 180px)' }}>
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                {/* Section 1: Basic Info */}
                <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--color-border-light)' }}>
                  <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}><FileType size={14} /> Thông tin chung</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Tiêu đề báo giá <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <input 
                        className="form-input" 
                        style={{ fontWeight: 700 }}
                        placeholder="VD: Báo giá triển khai hệ thống quản trị..." 
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group" style={{ position: 'relative' }} ref={contactSearchRef}>
                        <label className="form-label">Khách hàng nhận <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 1rem', height: '44px', border: `1.5px solid ${selectedContact ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', transition: 'all 0.2s', boxShadow: selectedContact ? '0 0 0 4px var(--color-primary-light)' : 'none' }}>
                          <User size={16} style={{ color: selectedContact ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0 }} />
                          <input 
                            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: selectedContact ? 700 : 400 }}
                            placeholder="Tìm theo tên, SĐT hoặc Email..." 
                            value={selectedContact ? `${selectedContact.first_name} ${selectedContact.last_name || ''}` : searchContact}
                            onChange={e => { setSearchContact(e.target.value); setShowContactResults(true); if (selectedContact) setSelectedContact(null); }}
                            onFocus={() => setShowContactResults(true)}
                          />
                          {(selectedContact || searchContact) && (
                            <button type="button" onClick={() => { setSelectedContact(null); setSearchContact(''); }} style={{ color: 'var(--color-text-muted)', display: 'flex' }}>
                              <X size={14} />
                            </button>
                          )}
                          <ChevronDown size={14} style={{ color: 'var(--color-text-muted)', transform: showContactResults ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </div>

                        {showContactResults && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: '0 20px 40px -8px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
                            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-bg)' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>Kết quả tìm kiếm</span>
                            </div>
                            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                              {filteredContacts.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Không tìm thấy khách hàng nào</div>
                              ) : (
                                filteredContacts.map(c => (
                                  <div 
                                    key={c.id}
                                    onClick={() => { setSelectedContact(c); setShowContactResults(false); setSearchContact(''); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0, border: '1px solid var(--color-primary-light)' }}>
                                      {c.first_name?.[0]}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{c.first_name} {c.last_name || ''}</p>
                                      <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {c.phone && <span>{c.phone}</span>}
                                        {c.phone && c.email && <span>•</span>}
                                        {c.email && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>}
                                      </p>
                                    </div>
                                    {c.company_name && (
                                      <div style={{ fontSize: '0.65rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                                        {c.company_name}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Ngày hết hiệu lực</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 1rem', height: '44px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)' }}>
                          <Calendar size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                          <input 
                            type="date"
                            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', color: 'var(--color-text)' }}
                            value={form.valid_until}
                            onChange={e => setForm({ ...form, valid_until: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                  {/* Section 2: Items */}
                <div className="card overflow-hidden" style={{ border: '1px solid var(--color-border-light)' }}>
                  <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                      <Package size={14} /> Danh mục hàng hóa
                    </h3>
                    {/* Premium product search */}
                    <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }} ref={productSearchRef}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 0.875rem', height: '40px', border: `1.5px solid ${showProductDropdown ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: '12px', background: showProductDropdown ? 'var(--color-primary-light)' : 'var(--color-bg)', transition: 'all 0.2s', boxShadow: showProductDropdown ? '0 0 0 3px var(--color-primary-light)' : 'none' }}>
                        <Search size={15} style={{ color: showProductDropdown ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0 }} />
                        <input
                          placeholder="Thêm sản phẩm / dịch vụ..."
                          style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.8125rem', color: 'var(--color-text)', fontWeight: 500 }}
                          value={searchProduct}
                          onChange={e => setSearchProduct(e.target.value)}
                          onFocus={() => setShowProductDropdown(true)}
                        />
                        {searchProduct && <button type="button" onClick={() => { setSearchProduct(''); }} style={{ color: 'var(--color-text-muted)', display: 'flex', flexShrink: 0 }}><X size={13} /></button>}
                        <div style={{ flexShrink: 0, width: 1, height: 16, background: 'var(--color-border)' }} />
                        <Plus size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      </div>
                      {/* Dropdown */}
                      {showProductDropdown && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: '0 20px 40px -8px rgba(0,0,0,0.15)', zIndex: 200, overflow: 'hidden' }}>
                          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-bg)' }}>
                            <Package size={12} style={{ color: 'var(--color-primary)' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
                              {searchProduct ? `Kết quả tìm kiếm` : `Tất cả sản phẩm (${products.length})`}
                            </span>
                          </div>
                          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {filteredProducts.length === 0 ? (
                              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                <Package size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                                <p>Không tìm thấy sản phẩm</p>
                              </div>
                            ) : filteredProducts.map(p => {
                              const alreadyAdded = items.some(i => i.product_id === p.id);
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => !alreadyAdded && addItem(p)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', cursor: alreadyAdded ? 'default' : 'pointer', transition: 'background 0.15s', opacity: alreadyAdded ? 0.5 : 1 }}
                                  onMouseEnter={e => { if (!alreadyAdded) e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, var(--color-primary-light), rgba(163, 20, 34,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(163, 20, 34,0.1)' }}>
                                    <Package size={16} style={{ color: 'var(--color-primary)' }} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                      {alreadyAdded && <span style={{ flexShrink: 0, fontSize: '0.6rem', background: '#10b98120', color: '#10b981', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>Đã thêm</span>}
                                    </div>
                                    {p.sku && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>SKU: {p.sku}</span>}
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary)' }}>{FMT(p.price)}</div>
                                    {p.description && <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Manual add option */}
                          <div
                            style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--color-bg)' }}
                            onClick={() => {
                              const manual: QuoteItem = { name: searchProduct || 'Hạng mục mới', quantity: 1, unit_price: 0, discount: 0, subtotal: 0 };
                              setItems(prev => [...prev, manual]);
                              setSearchProduct('');
                              setShowProductDropdown(false);
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: '8px', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Plus size={14} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                              {searchProduct ? `Thêm "${searchProduct}" thủ công` : 'Thêm hạng mục tùy chỉnh'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {items.length === 0 ? (
                        <div style={{ background: 'var(--color-bg)', border: '2px dashed var(--color-border-light)', borderRadius: '16px', padding: '3rem 2rem', textAlign: 'center' }}>
                          <div className="flex flex-col items-center gap-3 opacity-40">
                            <ShoppingCart size={48} strokeWidth={1.5} />
                            <p className="text-sm font-bold">Chưa có sản phẩm nào được chọn</p>
                            <p className="text-[10px] uppercase tracking-widest">Sử dụng thanh tìm kiếm phía trên để thêm</p>
                          </div>
                        </div>
                      ) : (
                        items.map((item, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '20px', 
                              display: 'flex', flexDirection: 'column', gap: '14px', transition: 'all 0.2s', 
                              boxShadow: 'var(--shadow-sm)' 
                            }} 
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary-light)'} 
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-light)'}
                          >
                            
                            {/* Row 1: Name & Delete */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center' }}>
                              <div style={{ flex: 1 }}>
                                <input 
                                  style={{ width: '100%', border: 'none', borderBottom: '1.5px solid transparent', outline: 'none', background: 'transparent', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', paddingBottom: '2px', transition: 'border-color 0.2s' }}
                                  placeholder="Nhập tên sản phẩm / dịch vụ..."
                                  value={item.name}
                                  onChange={e => updateItem(idx, { name: e.target.value })}
                                  onFocus={e => e.target.style.borderBottomColor = 'var(--color-primary)'}
                                  onBlur={e => e.target.style.borderBottomColor = 'transparent'}
                                />
                              </div>
                              <button 
                                type="button" 
                                className="btn-icon sm" 
                                style={{ color: 'var(--color-danger)', border: 'none', background: 'var(--color-danger-light)', width: '32px', height: '32px', flexShrink: 0 }} 
                                onClick={() => removeItem(idx)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            
                            {/* Row 2: Description (styled textbox) */}
                            <div style={{ width: '100%' }}>
                              <textarea 
                                style={{ width: '100%', border: '1px solid var(--color-border-light)', borderRadius: '8px', padding: '8px 12px', outline: 'none', fontSize: '0.8125rem', color: 'var(--color-text-muted)', resize: 'vertical', minHeight: '52px', background: 'var(--color-bg)', lineHeight: 1.5, transition: 'all 0.2s' }}
                                placeholder="Mô tả chi tiết sản phẩm / dịch vụ (không bắt buộc)..."
                                value={item.description || ''}
                                onChange={e => updateItem(idx, { description: e.target.value })}
                                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.background = 'var(--color-surface)'; }}
                                onBlur={e => { e.target.style.borderColor = 'var(--color-border-light)'; e.target.style.background = 'var(--color-bg)'; }}
                                rows={2}
                              />
                            </div>
                            
                            {/* Row 3: Beautiful, aligned pricing grid */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                              gap: '1.25rem', 
                              alignItems: 'flex-start',
                              background: 'var(--color-bg)',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              border: '1px solid var(--color-border-light)'
                            }}>
                              {/* Quantity */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Số lượng</label>
                                <input 
                                  type="number" 
                                  style={{ width: '100%', height: '36px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: '8px', outline: 'none', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', transition: 'border 0.2s' }}
                                  value={item.quantity}
                                  min={1}
                                  onChange={e => updateItem(idx, { quantity: Math.max(1, Math.floor(Number(e.target.value))) })}
                                  onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                                  onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                />
                              </div>

                              {/* Unit Price */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đơn giá (đ)</label>
                                <input 
                                  type="number" 
                                  style={{ width: '100%', height: '36px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: '8px', outline: 'none', textAlign: 'right', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text)', padding: '0 10px', transition: 'border 0.2s' }}
                                  value={item.unit_price}
                                  onChange={e => updateItem(idx, { unit_price: Number(e.target.value) })}
                                  onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                                  onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                />
                                {item.unit_price > 0 && (
                                  <div style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic', marginTop: '4px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.2, textAlign: 'right' }}>
                                    {numberToText(item.unit_price)}
                                  </div>
                                )}
                              </div>

                              {/* Discount */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Giảm (%)</label>
                                <div style={{ position: 'relative' }}>
                                  <input 
                                    type="number" 
                                    style={{ width: '100%', height: '36px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: '8px', outline: 'none', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-danger)', paddingRight: '20px', transition: 'border 0.2s' }}
                                    value={item.discount}
                                    max={100}
                                    onChange={e => updateItem(idx, { discount: Math.min(100, Number(e.target.value)) })}
                                    onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                                  />
                                  <Percent size={12} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-danger)', pointerEvents: 'none' }} />
                                </div>
                              </div>

                              {/* Subtotal */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'right' }}>
                                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thành tiền</label>
                                <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '1.05rem', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>
                                  {FMT(item.subtotal)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1 }}>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <label className="form-label">Ghi chú nội bộ</label>
                    <textarea 
                      className="form-textarea"
                      style={{ flex: 1, minHeight: '120px', resize: 'none' }}
                      placeholder="Lời nhắn hoặc ghi chú đặc biệt..."
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <label className="form-label">Điều khoản áp dụng</label>
                    <textarea 
                      className="form-textarea"
                      style={{ flex: 1, minHeight: '120px', resize: 'none' }}
                      value={form.terms}
                      onChange={e => setForm({ ...form, terms: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Financials - Sticky */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '10px', height: 'fit-content' }}>
                <div className="card overflow-hidden" style={{ border: '1px solid var(--color-border-light)', borderRadius: '20px' }}>
                  {/* Panel header */}
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)' }}>
                    <Calculator size={16} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text)' }}>Tóm tắt tài chính</span>
                  </div>

                  <div style={{ background: 'var(--color-surface)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Subtotal row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>Thành tiền hàng</span>
                      <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--color-text)' }}>{FMT(subtotal)}</span>
                    </div>

                    {/* Discount row */}
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>Giảm giá (₫)</span>
                      <input
                        type="number"
                        style={{
                          width: '110px', height: '34px', padding: '0 10px', textAlign: 'right',
                          border: '1px solid var(--color-border)', borderRadius: '8px',
                          fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-danger)',
                          background: 'var(--color-danger-light)', outline: 'none',
                        }}
                        value={form.discount}
                        onChange={e => setForm({ ...form, discount: Number(e.target.value) })}
                      />
                      {form.discount > 0 && (
                        <div style={{ position: 'absolute', bottom: '-18px', right: '1.25rem', fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                          {numberToText(form.discount)}
                        </div>
                      )}
                    </div>

                    {/* Tax row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>Thuế VAT (%)</span>
                      <input
                        type="number"
                        style={{
                          width: '70px', height: '34px', padding: '0 10px', textAlign: 'center',
                          border: '1px solid var(--color-border)', borderRadius: '8px',
                          fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)',
                          background: 'var(--color-bg)', outline: 'none',
                        }}
                        value={form.tax_rate}
                        onChange={e => setForm({ ...form, tax_rate: Number(e.target.value) })}
                      />
                    </div>

                    {/* Tax amount */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px dashed var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tiền thuế</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>+{FMT(taxAmount)}</span>
                    </div>

                    {/* Total */}
                    <div style={{ background: 'var(--color-primary-light)', borderRadius: '12px', padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Tổng cộng báo giá</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--color-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{FMT(total)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Đã bao gồm thuế & chiết khấu</div>
                      {total > 0 && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 700, fontStyle: 'italic', marginTop: '10px', lineHeight: 1.4, borderTop: '1px solid rgba(189, 29, 45, 0.1)', paddingTop: '8px' }}>
                          {numberToText(total)}
                        </div>
                      )}
                    </div>

                    {/* Status toggle */}
                    <div style={{ paddingTop: '0.25rem' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '8px' }}>Trạng thái</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {[
                          { id: 'draft', label: 'Lưu Nháp' },
                          { id: 'sent',  label: 'Chờ phản hồi' },
                        ].map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setForm({ ...form, status: s.id })}
                            style={{
                              height: '36px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s',
                              border: form.status === s.id ? '1.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                              background: form.status === s.id ? 'var(--color-primary)' : 'var(--color-surface)',
                              color: form.status === s.id ? 'white' : 'var(--color-text-muted)',
                            }}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>


              </div>
            </div>
            </fieldset>
          </div>

          <div className="modal-footer" style={{ padding: '0.75rem 2rem', background: 'var(--color-bg)', borderTop: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
             <button className="btn ghost font-bold text-muted" onClick={onClose}>
               {isViewerProp ? 'Đóng' : 'Hủy bỏ'}
             </button>
             {isViewerProp ? (
               currentUser?.role !== 'viewer' && onEdit && (
                 <button 
                   className="btn primary" 
                   style={{ minWidth: '220px', background: 'var(--color-primary)', color: 'white' }}
                   onClick={onEdit}
                 >
                   Chỉnh sửa báo giá
                 </button>
               )
             ) : (
               <button 
                 className="btn primary" 
                 style={{ minWidth: '220px', boxShadow: isViewer ? 'none' : '0 10px 20px -5px rgba(163, 20, 34, 0.4)', background: isViewer ? 'var(--color-border)' : 'var(--color-primary)', color: isViewer ? 'var(--color-text-muted)' : 'white' }}
                 onClick={handleSave}
                 disabled={loading || isViewer}
               >
                 {loading ? <Loader2 className="animate-spin" /> : (isViewer ? 'Bạn không có quyền chỉnh sửa' : (quote ? 'Cập nhật thay đổi' : 'Xác nhận & Lưu báo giá'))}
               </button>
             )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
};
