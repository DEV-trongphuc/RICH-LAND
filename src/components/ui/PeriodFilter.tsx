import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type Period = '7d' | '30d' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'custom';

export interface DateRange {
  from: string;
  to: string;
}

export interface PeriodFilterProps {
  value: Period;
  onChange: (period: Period, range: DateRange) => void;
  customRange?: DateRange;
  onCustomRange?: (range: DateRange) => void;
}

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'this_month', label: 'Tháng này' },
  { key: 'last_month', label: 'Tháng trước' },
  { key: 'this_quarter', label: 'Quý này' },
  { key: 'last_quarter', label: 'Quý trước' },
  { key: 'this_year', label: 'Năm này' },
  { key: 'custom', label: 'Tùy chọn' },
];

export function getDateRange(period: Period, custom?: DateRange): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.toISOString().slice(0, 10);

  switch (period) {
    case '7d': {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    case '30d': {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    case 'this_month':
      return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: today };
    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const days = new Date(ly, lm + 1, 0).getDate();
      return {
        from: `${ly}-${String(lm + 1).padStart(2, '0')}-01`,
        to: `${ly}-${String(lm + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`,
      };
    }
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      return { from: `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`, to: today };
    }
    case 'last_quarter': {
      const q = Math.floor(m / 3);
      const lq = q === 0 ? 3 : q - 1;
      const lqy = q === 0 ? y - 1 : y;
      const lqEnd = lq * 3 + 3;
      const lqEndDate = new Date(lqy, lqEnd, 0).getDate();
      return {
        from: `${lqy}-${String(lq * 3 + 1).padStart(2, '0')}-01`,
        to: `${lqy}-${String(lqEnd).padStart(2, '0')}-${String(lqEndDate).padStart(2, '0')}`,
      };
    }
    case 'this_year':
      return { from: `${y}-01-01`, to: today };
    case 'custom':
      return custom || { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: today };
    default:
      return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: today };
  }
}

export const PeriodFilter: React.FC<PeriodFilterProps> = ({ value, onChange, customRange, onCustomRange }) => {
  const currentLabel = PERIODS.find(p => p.key === value)?.label || 'Chọn kỳ';
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [tempFrom, setTempFrom] = useState(customRange?.from || '');
  const [tempTo, setTempTo] = useState(customRange?.to || '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowCustom(false);
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handlePeriod = (p: Period) => {
    if (p === 'custom') { setShowCustom(true); setIsOpen(false); return; }
    setShowCustom(false);
    setIsOpen(false);
    onChange(p, getDateRange(p));
  };

  const applyCustom = () => {
    if (!tempFrom || !tempTo) return;
    const range = { from: tempFrom, to: tempTo };
    onCustomRange?.(range);
    onChange('custom', range);
    setShowCustom(false);
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button 
        className="btn secondary"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px', justifyContent: 'space-between',
          padding: '0 1rem', height: 38, fontSize: '0.875rem', borderRadius: 'var(--radius-md)',
          background: isOpen ? 'var(--color-bg)' : 'white',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
          <Calendar size={18} style={{ color: 'var(--color-text-muted)' }} />
          {value === 'custom' && customRange 
            ? `${customRange.from.slice(5)} → ${customRange.to.slice(5)}` 
            : currentLabel}
        </span>
        <ChevronDown size={18} style={{ color: 'var(--color-text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Period Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--color-surface)', border: '1px solid var(--color-border-light)',
              borderRadius: 'var(--radius-xl)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
              zIndex: 500, padding: '0.75rem', minWidth: '220px',
            }}
          >
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', padding: '0 0.5rem', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Chọn kỳ báo cáo</p>
            {PERIODS.map(p => (
              <button
                key={p.key}
                className={`dropdown-item ${value === p.key ? 'active' : ''}`}
                onClick={() => handlePeriod(p.key)}
                style={{ 
                  width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
                  fontSize: '0.9375rem', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: value === p.key ? 'var(--color-primary-light)' : 'transparent',
                  color: value === p.key ? 'var(--color-primary)' : 'var(--color-text)',
                  border: 'none', cursor: 'pointer', fontWeight: value === p.key ? 700 : 500,
                  transition: 'background 0.2s'
                }}
              >
                {p.key === 'custom' && <Calendar size={16} />}
                {p.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom date picker dropdown */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)',
              zIndex: 500, padding: '1.25rem', minWidth: '280px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>Chọn khoảng thời gian</p>
              <button onClick={() => setShowCustom(false)} style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}><X size={15} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Từ ngày</label>
                <input
                  className="form-input"
                  type="date"
                  value={tempFrom}
                  onChange={e => setTempFrom(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Đến ngày</label>
                <input
                  className="form-input"
                  type="date"
                  value={tempTo}
                  min={tempFrom}
                  onChange={e => setTempTo(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn outline sm" onClick={() => setShowCustom(false)}>Hủy</button>
              <button className="btn primary sm" onClick={applyCustom} disabled={!tempFrom || !tempTo}>Áp dụng</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
