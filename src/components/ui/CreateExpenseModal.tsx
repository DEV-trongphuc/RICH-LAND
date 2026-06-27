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
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().substring(0, 10),
    category: 'Ăn uống',
    notes: '',
    beneficiary: '', // free text or selected supplier
  });
  const [loading, setLoading] = useState(false);

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
      .filter(c => `${c.first_name} ${c.last_name} ${c.phone} ${c.email}`.toLowerCase().includes(q))
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
      <div className="overlay-backdrop" style={{ zIndex: 9999 }}>
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
                <Building2 size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
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
                            name: `${c.first_name} ${c.last_name || ''}`.trim(),
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
                        <Avatar name={`${c.first_name} ${c.last_name}`} size={32} src={c.avatar_url} />
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
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button className="btn outline" onClick={onClose}>Hủy</button>
            <button
              className="btn primary"
              onClick={handleSubmit}
              disabled={loading}
              style={{ minWidth: '160px' }}
            >
              {loading ? 'Đang lưu...' : '✓ Gửi phê duyệt'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
