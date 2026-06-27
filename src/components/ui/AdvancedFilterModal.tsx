import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Filter, Plus, Trash2, HelpCircle, DollarSign, MapPin, Target, Zap, Clock, User, Globe, Hash } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

export interface FilterRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface AdvancedFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (rules: FilterRule[], matchType: 'AND' | 'OR') => void;
  initialRules?: FilterRule[];
  initialMatchType?: 'AND' | 'OR';
}

const FIELDS = [
  { value: 'status', label: 'Trạng thái', icon: <Zap size={14} /> },
  { value: 'source', label: 'Nguồn', icon: <Globe size={14} /> },
  { value: 'city', label: 'Thành phố', icon: <MapPin size={14} /> },
  { value: 'expected_revenue', label: 'Dự kiến doanh thu', icon: <DollarSign size={14} /> },
  { value: 'win_probability', label: 'Xác suất chốt (%)', icon: <Target size={14} /> },
  { value: 'has_called', label: 'Đã liên hệ', icon: <Clock size={14} /> }
];

const OPERATORS: Record<string, {value: string, label: string}[]> = {
  'status': [
    { value: 'equals', label: 'Bằng' },
    { value: 'not_equals', label: 'Khác' }
  ],
  'source': [
    { value: 'equals', label: 'Bằng' },
    { value: 'not_equals', label: 'Khác' }
  ],
  'city': [
    { value: 'equals', label: 'Bằng' },
    { value: 'contains', label: 'Chứa' }
  ],
  'expected_revenue': [
    { value: 'greater_than', label: 'Lớn hơn' },
    { value: 'less_than', label: 'Nhỏ hơn' }
  ],
  'win_probability': [
    { value: 'greater_than', label: 'Lớn hơn' },
    { value: 'less_than', label: 'Nhỏ hơn' }
  ],
  'has_called': [
    { value: 'equals', label: 'Là' }
  ]
};

export const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({ isOpen, onClose, onApply, initialRules = [], initialMatchType = 'AND' }) => {
  const [rules, setRules] = useState<FilterRule[]>(initialRules.length > 0 ? initialRules : [{ id: '1', field: 'status', operator: 'equals', value: '' }]);
  const [matchType, setMatchType] = useState<'AND' | 'OR'>(initialMatchType);

  const addRule = () => {
    setRules([...rules, { id: Date.now().toString(), field: 'status', operator: 'equals', value: '' }]);
  };

  const removeRule = (id: string) => {
    if (rules.length > 1) {
      setRules(rules.filter(r => r.id !== id));
    }
  };

  const updateRule = (id: string, key: keyof FilterRule, val: string) => {
    setRules(rules.map(r => {
      if (r.id === id) {
        const updated = { ...r, [key]: val };
        // Reset operator if field changes
        if (key === 'field') {
          updated.operator = OPERATORS[val][0].value;
          updated.value = '';
        }
        return updated;
      }
      return r;
    }));
  };

  const handleApply = () => {
    onApply(rules.filter(r => r.value !== ''), matchType);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div key="backdrop" className="overlay-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ zIndex: 500 }} />
          <motion.div 
            key="modal"
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'var(--color-surface)', width: '640px', maxWidth: 'calc(100vw - 2rem)',
              borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', zIndex: 510,
              border: '1px solid var(--color-border)'
            }}
            initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={18} color="var(--color-primary)" /> Bộ lọc nâng cao (Query Builder)
              </h3>
              <button className="btn-icon-bare" onClick={onClose}><X size={18} /></button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-bg)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Hiển thị kết quả thỏa mãn:</span>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-surface)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <button 
                    onClick={() => setMatchType('AND')}
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', background: matchType === 'AND' ? 'var(--color-primary)' : 'transparent', color: matchType === 'AND' ? 'white' : 'var(--color-text-light)' }}
                  >TẤT CẢ (AND)</button>
                  <button 
                    onClick={() => setMatchType('OR')}
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', background: matchType === 'OR' ? 'var(--color-primary)' : 'transparent', color: matchType === 'OR' ? 'white' : 'var(--color-text-light)' }}
                  >BẤT KỲ (OR)</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <AnimatePresence>
                  {rules.map((rule, index) => (
                    <motion.div 
                      key={rule.id}
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <CustomSelect 
                          options={FIELDS}
                          value={rule.field}
                          onChange={(v) => updateRule(rule.id, 'field', v as string)}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <CustomSelect 
                          options={OPERATORS[rule.field] || []}
                          value={rule.operator}
                          onChange={(v) => updateRule(rule.id, 'operator', v as string)}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {rule.field === 'has_called' ? (
                          <CustomSelect 
                            options={[{value: 'true', label: 'Có'}, {value: 'false', label: 'Không'}]}
                            value={rule.value}
                            onChange={(v) => updateRule(rule.id, 'value', v as string)}
                          />
                        ) : (
                          <input 
                            className="form-input" 
                            placeholder="Giá trị..." 
                            value={rule.value} 
                            onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                            style={{ height: '40px' }}
                          />
                        )}
                      </div>
                      {rules.length > 1 && (
                        <button className="btn-icon-bare" style={{ color: 'var(--color-text-muted)', height: '40px', padding: '0 8px' }} onClick={() => removeRule(rule.id)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div>
                <button className="btn ghost sm" onClick={addRule} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)' }}>
                  <Plus size={14} /> Thêm điều kiện lọc
                </button>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', background: 'var(--color-bg)' }}>
              <button className="btn ghost" onClick={() => setRules([{ id: '1', field: 'status', operator: 'equals', value: '' }])}>Xóa bộ lọc</button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn secondary" onClick={onClose}>Hủy bỏ</button>
                <button className="btn primary" onClick={handleApply}>Áp dụng Bộ lọc</button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
