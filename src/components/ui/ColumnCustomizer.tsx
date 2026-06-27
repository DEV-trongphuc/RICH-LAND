import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Columns } from 'lucide-react';
import { CustomCheckbox } from './CustomCheckbox';

export interface ColumnDef {
  id: string;
  label: string;
  visible: boolean;
}

interface ColumnCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnDef[];
  onChange: (columns: ColumnDef[]) => void;
}

export const ColumnCustomizer: React.FC<ColumnCustomizerProps> = ({ isOpen, onClose, columns, onChange }) => {
  const toggleCol = (id: string) => {
    onChange(columns.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const showAll = () => onChange(columns.map(c => ({ ...c, visible: true })));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div key="backdrop" className="overlay-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ zIndex: 500, background: 'rgba(0,0,0,0.1)' }} />
          <motion.div 
            key="modal"
            style={{
              position: 'fixed', top: '4rem', right: '1rem',
              background: 'var(--color-surface)', width: '300px',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', zIndex: 510,
              border: '1px solid var(--color-border)', overflow: 'hidden'
            }}
            initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }}
          >
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Columns size={16} color="var(--color-primary)" /> Tùy chỉnh cột hiển thị
              </h3>
              <button className="btn-icon-bare" onClick={onClose}><X size={16} /></button>
            </div>

            <div style={{ padding: '0.75rem', maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {columns.map(col => (
                <label 
                  key={col.id} 
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', 
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <CustomCheckbox 
                    checked={col.visible} 
                    onChange={() => toggleCol(col.id)} 
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: col.visible ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {col.label}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center', background: 'var(--color-bg)' }}>
              <button className="btn ghost sm" onClick={showAll} style={{ width: '100%', color: 'var(--color-primary)' }}>Hiện tất cả</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
