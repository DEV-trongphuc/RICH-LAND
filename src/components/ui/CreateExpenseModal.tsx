import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Calendar, DollarSign, Users, Briefcase, FileText, 
  Building2, Search, Check, ChevronDown, StickyNote,
  Car, UtensilsCrossed, Settings, Gift, Wrench, User
} from 'lucide-react';
import api from '../../api/axios';
import { useUIStore } from '../../store/uiStore';
import { Avatar } from './Avatar';
import { numberToVietnameseText } from '../../utils/numberToText';
import { useAuth } from '../../contexts/AuthContext';
import { compressToWebP } from '../../utils/imageCompress';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialEntity?: { type: 'contact' | 'company' | 'deal'; id: number; name: string };
  onSuccess?: () => void;
}

const CATEGORIES = [
  { id: 'Di chuyển', label: 'Di chuyển', icon: Car, color: '#3b82f6' },
  { id: 'Ăn uống', label: 'Ăn uống', icon: UtensilsCrossed, color: '#f59e0b' },
  { id: 'Vận hành', label: 'Vận hành', icon: Settings, color: '#BD1D2D' },
  { id: 'Marketing', label: 'Marketing', icon: Briefcase, color: '#ec4899' },
  { id: 'Công cụ', label: 'Công cụ', icon: Wrench, color: '#10b981' },
  { id: 'Nhân sự', label: 'Nhân sự', icon: User, color: '#f97316' },
  { id: 'Quà tặng', label: 'Quà tặng', icon: Gift, color: '#ef4444' },
  { id: 'Khác', label: 'Khác', icon: FileText, color: '#6b7280' },
];

export const CreateExpenseModal: React.FC<Props> = ({ isOpen, onClose, initialEntity, onSuccess }) => {
  const { addToast } = useUIStore();
  const { user: currentUser } = useAuth();
  const isViewer = currentUser?.role === 'viewer';
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().substring(0, 10),
    category: 'Ăn uống',
    notes: '',
    beneficiary: '', // free text or selected supplier
    has_vat_invoice: false,
    is_vat_inclusive: false,
    vat_amount: '',
    image_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImg(true);
    try {
      const compressedFile = await compressToWebP(file);
      const uploadData = new FormData();
      uploadData.append('file', compressedFile);
      if (formData.image_url) {
        uploadData.append('previous_url', formData.image_url);
      }
      const res = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.success && res.data.data?.url) {
        setFormData(prev => ({ ...prev, image_url: res.data.data.url }));
        addToast('Tải lên và nén ảnh hóa đơn thành công!', 'success');
      } else {
        addToast('Tải ảnh thất bại', 'error');
      }
    } catch (err: any) {
      addToast('Lỗi khi nén & tải ảnh: ' + (err.message || err), 'error');
    } finally {
      setUploadingImg(false);
    }
  };

  // Entities selection
  const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Beneficiary (supplier) search
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [showBeneficiaryResults, setShowBeneficiaryResults] = useState(false);
  const beneficiaryRef = useRef<HTMLDivElement>(null);

  // Contact search
  const [contactSearch, setContactSearch] = useState('');
  const [showContactResults, setShowContactResults] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        amount: '',
        date: new Date().toISOString().substring(0, 10),
        category: 'Ăn uống',
        notes: '',
        beneficiary: '',
        has_vat_invoice: false,
        is_vat_inclusive: false,
        vat_amount: '',
        image_url: '',
      });
      setBeneficiarySearch('');
      setContactSearch('');
      if (initialEntity && initialEntity.type === 'contact') {
        setSelectedContacts([{ id: initialEntity.id, name: initialEntity.name }]);
      } else {
        setSelectedContacts([]);
      }

      api.get('/contacts').then(res => {
        setContacts(res.data.data?.items || res.data.data || []);
      }).catch(() => {});

      api.get('/suppliers').then(res => {
        setSuppliers(res.data.data?.items || res.data.data || []);
      }).catch(() => {});
    }
  }, [isOpen, initialEntity]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (beneficiaryRef.current && !beneficiaryRef.current.contains(e.target as Node)) {
        setShowBeneficiaryResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuppliers = useMemo(() => {
    const q = beneficiarySearch.toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers.filter(s => 
      (s.name || s.company_name || '').toLowerCase().includes(q) || 
      (s.phone || '').includes(q)
    ).slice(0, 8);
  }, [suppliers, beneficiarySearch]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return [];
    const q = contactSearch.toLowerCase();
    return contacts
      .filter(c => !selectedContacts.find(sc => sc.id === c.id))
      .filter(c => `${c.last_name} ${c.first_name} ${c.phone} ${c.email}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [contacts, contactSearch, selectedContacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) {
      addToast('Vui lòng nhập tiêu đề và số tiền', 'error');
      return;
    }

    setLoading(true);
    try {
      const amountNum = parseFloat(String(formData.amount).replace(/,/g, ''));

      let entities: any[] = [];
      if (selectedContacts.length > 0) {
        const splitAmount = amountNum / selectedContacts.length;
        entities = selectedContacts.map(c => ({
          entity_type: 'contact',
          entity_id: c.id,
          amount: splitAmount
        }));
      } else if (initialEntity) {
        entities = [{
          entity_type: initialEntity.type,
          entity_id: initialEntity.id,
          amount: amountNum
        }];
      }

      await api.post('/expenses', {
        title: formData.title,
        amount: amountNum,
        date: formData.date,
        category: formData.category,
        notes: formData.notes,
        beneficiary: formData.beneficiary || beneficiarySearch,
        vendor_name: formData.beneficiary || beneficiarySearch,
        has_vat_invoice: formData.has_vat_invoice ? 1 : 0,
        is_vat_inclusive: formData.is_vat_inclusive ? 1 : 0,
        vat_amount: formData.has_vat_invoice ? parseFloat(String(formData.vat_amount || 0).replace(/,/g, '')) : 0,
        image_url: formData.image_url || null,
        entities,
      });

      addToast('Đã tạo chi phí thành công', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi tạo chi phí', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="overlay-backdrop" style={{ zIndex: 1000020 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          className="modal-sheet"
          style={{ width: '100%', maxWidth: '560px' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '12px',
                background: 'linear-gradient(135deg, #a31422, #BD1D2D)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(163, 20, 34,0.25)'
              }}>
                <DollarSign size={22} color="white" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text)' }}>Nhập Chi phí Mới</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ghi nhận và theo dõi chi tiêu của nhóm</p>
              </div>
            </div>
            <button className="btn-icon sm" onClick={onClose}><X size={18} /></button>
          </div>

          {/* Body */}
          <div className="modal-body" style={{ gap: '1.25rem' }}>
            <fieldset disabled={isViewer} style={{ border: 'none', padding: 0, margin: 0, width: '100%', display: 'contents' }}>

            {/* Title */}
            <div className="form-group">
              <label className="form-label">Nội dung chi <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                className="form-input"
                placeholder="VD: Thuê văn phòng tháng 6, Mua nguyên liệu..."
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                autoFocus
              />
            </div>

            {/* Beneficiary - Smart search/type */}
            <div className="form-group" style={{ position: 'relative' }} ref={beneficiaryRef}>
              <label className="form-label">Đơn vị thụ hưởng <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>(Thanh toán cho ai?)</span></label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '0 1rem', height: '44px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
                onFocus={() => setShowBeneficiaryResults(true)}
                tabIndex={-1}
              >
                <input
                  style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', color: 'var(--color-text)' }}
                  placeholder="Tìm nhà cung cấp hoặc nhập tự do..."
                  value={beneficiarySearch || formData.beneficiary}
                  onChange={e => {
                    setBeneficiarySearch(e.target.value);
                    setFormData({ ...formData, beneficiary: e.target.value });
                    setShowBeneficiaryResults(true);
                  }}
                  onFocus={() => setShowBeneficiaryResults(true)}
                />
                {(formData.beneficiary || beneficiarySearch) && (
                  <button onClick={() => { setBeneficiarySearch(''); setFormData({ ...formData, beneficiary: '' }); }} style={{ color: 'var(--color-text-muted)', display: 'flex' }}>
                    <X size={14} />
                  </button>
                )}
                <Building2 size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <ChevronDown size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              </div>

              <AnimatePresence>
                {showBeneficiaryResults && filteredSuppliers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                      background: 'var(--color-surface)', borderRadius: '16px',
                      border: '1px solid var(--color-border-light)',
                      boxShadow: '0 20px 40px -8px rgba(0,0,0,0.12)',
                      zIndex: 100, overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
                        Nhà cung cấp trong hệ thống
                      </span>
                    </div>
                    {(Array.isArray(filteredSuppliers) ? filteredSuppliers : []).map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          const name = s.name || s.company_name || '';
                          setFormData({ ...formData, beneficiary: name });
                          setBeneficiarySearch(name);
                          setShowBeneficiaryResults(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: '10px',
                          background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          fontSize: '0.8rem', fontWeight: 800,
                        }}>
                          {(s.name || s.company_name || '?')[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{s.name || s.company_name}</p>
                          {s.phone && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{s.phone}</p>}
                        </div>
                        {(formData.beneficiary === (s.name || s.company_name)) && (
                          <Check size={16} style={{ color: 'var(--color-primary)' }} />
                        )}
                      </div>
                    ))}
                    {beneficiarySearch && !filteredSuppliers.find(s => (s.name || s.company_name) === beneficiarySearch) && (
                      <div
                        onClick={() => { setFormData({ ...formData, beneficiary: beneficiarySearch }); setShowBeneficiaryResults(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', cursor: 'pointer',
                          borderTop: '1px solid var(--color-border-light)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                          + Dùng "{beneficiarySearch}" (nhập tự do)
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Amount + Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Số tiền (VNĐ) <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '0 1rem', height: '44px',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-surface)',
                }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>₫</span>
                  <input
                    type="number"
                    style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text)' }}
                    placeholder="0"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                {formData.amount && Number(formData.amount) > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, marginTop: '6px', fontStyle: 'italic' }}
                  >
                    Bằng chữ: {numberToVietnameseText(formData.amount)}
                  </motion.div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Ngày chi</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '0 1rem', height: '44px',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-surface)',
                }}>
                  <Calendar size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                  <input
                    type="date"
                    style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', color: 'var(--color-text)' }}
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Category Pills */}
            <div className="form-group">
              <label className="form-label">Danh mục chi phí</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isActive = formData.category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '6px 14px', borderRadius: '10px', cursor: 'pointer',
                        fontSize: '0.8125rem', fontWeight: 700, transition: 'all 0.18s',
                        border: `1.5px solid ${isActive ? cat.color : 'var(--color-border)'}`,
                        background: isActive ? `${cat.color}18` : 'var(--color-surface)',
                        color: isActive ? cat.color : 'var(--color-text-muted)',
                        transform: isActive ? 'translateY(-1px)' : 'none',
                        boxShadow: isActive ? `0 4px 12px ${cat.color}30` : 'none',
                      }}
                    >
                      <Icon size={14} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Apply to Contact (Bill Split) */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Áp dụng cho khách hàng <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>(Chia đều tiền bill)</span></label>
              
              {selectedContacts.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {selectedContacts.map(c => (
                    <span key={c.id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                      padding: '4px 10px', borderRadius: '10px', fontSize: '0.8125rem', fontWeight: 700,
                      border: '1px solid rgba(163, 20, 34,0.2)',
                    }}>
                      <Avatar name={c.name} size={18} />
                      {c.name}
                      <button type="button" onClick={() => setSelectedContacts(prev => prev.filter(x => x.id !== c.id))} style={{ display: 'flex', marginLeft: '2px', color: 'var(--color-primary)' }}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '0 1rem', height: '44px',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface)',
              }}>
                <Search size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <input
                  style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.875rem', color: 'var(--color-text)' }}
                  placeholder="Tìm khách hàng để thêm vào bill..."
                  value={contactSearch}
                  onChange={e => { setContactSearch(e.target.value); setShowContactResults(true); }}
                  onFocus={() => setShowContactResults(true)}
                />
              </div>

              <AnimatePresence>
                {showContactResults && filteredContacts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                      background: 'var(--color-surface)', borderRadius: '16px',
                      border: '1px solid var(--color-border-light)',
                      boxShadow: '0 20px 40px -8px rgba(0,0,0,0.12)',
                      zIndex: 100, overflow: 'hidden',
                    }}
                  >
                    {filteredContacts.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedContacts(prev => [...prev, {
                            id: c.id,
                            name: `${c.last_name || ''} ${c.first_name}`.trim(),
                            avatar: c.avatar_url,
                          }]);
                          setContactSearch('');
                          setShowContactResults(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Avatar name={`${c.last_name} ${c.first_name}`} size={32} src={c.avatar_url} />
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{c.first_name} {c.last_name || ''}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.phone || c.email}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <StickyNote size={14} style={{ color: 'var(--color-text-muted)' }} />
                Ghi chú thêm
              </label>
              <textarea
                className="form-textarea"
                style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="Mô tả chi tiết, mã hóa đơn, lý do chi..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
             </div>

            {/* VAT & Invoice details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.has_vat_invoice}
                    onChange={e => setFormData({ ...formData, has_vat_invoice: e.target.checked })}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  Xuất hóa đơn VAT (Có hóa đơn đỏ)
                </label>
              </div>

              {formData.has_vat_invoice && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Số tiền VAT (VNĐ)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="VD: 50000"
                        value={formData.vat_amount}
                        onChange={e => setFormData({ ...formData, vat_amount: e.target.value })}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', marginTop: '1.25rem' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.is_vat_inclusive}
                          onChange={e => setFormData({ ...formData, is_vat_inclusive: e.target.checked })}
                          style={{ accentColor: 'var(--color-primary)' }}
                        />
                        Giá bán đã bao gồm thuế VAT
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Receipt Image link & Upload */}
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Ảnh chụp hóa đơn / chứng từ đính kèm</span>
                {formData.image_url && (
                  <button 
                    type="button" 
                    className="btn-icon-bare text-danger" 
                    onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                    style={{ fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: 0 }}
                  >
                    Xóa ảnh
                  </button>
                )}
              </label>
              
              {formData.image_url ? (
                /* Image Preview Mode */
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '10px', 
                  border: '1px solid var(--color-border-light)', 
                  borderRadius: '10px',
                  background: 'var(--color-bg-alt)',
                  position: 'relative'
                }}>
                  <img 
                    src={formData.image_url.startsWith('http') ? formData.image_url : `${import.meta.env.VITE_API_URL || '/backend'}/${formData.image_url.replace(/^\//, '')}`} 
                    alt="Hóa đơn đính kèm" 
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '8px', 
                      objectFit: 'cover',
                      border: '1px solid var(--color-border)'
                    }} 
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Đã tải lên ảnh hóa đơn
                    </p>
                    <a 
                      href={formData.image_url.startsWith('http') ? formData.image_url : `${import.meta.env.VITE_API_URL || '/backend'}/${formData.image_url.replace(/^\//, '')}`}
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Xem ảnh gốc
                    </a>
                  </div>
                </div>
              ) : (
                /* Upload Button / Drag Drop */
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Dán link ảnh hoặc tải lên file bên cạnh..."
                    value={formData.image_url}
                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <label style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: '1px dashed var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: uploadingImg ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      style={{ display: 'none' }} 
                      disabled={uploadingImg}
                    />
                    {uploadingImg ? 'Đang tải lên...' : 'Tải ảnh lên'}
                  </label>
                </div>
              )}
            </div>
            </fieldset>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button className="btn outline" onClick={onClose}>Hủy</button>
            <button
              className="btn primary"
              onClick={handleSubmit}
              disabled={loading || isViewer}
              style={{ minWidth: '160px', background: isViewer ? 'var(--color-border)' : 'var(--color-primary)', color: isViewer ? 'var(--color-text-muted)' : 'white' }}
            >
              {loading ? 'Đang lưu...' : (isViewer ? 'Bạn không có quyền gửi chi phí' : '✓ Gửi phê duyệt')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
