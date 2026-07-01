import React from 'react';
import { CustomModal } from './CustomModal';
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
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="Tùy chỉnh cột hiển thị"
      width={360}
    >
      <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {columns.map(col => (
          <label 
            key={col.id} 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', 
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

      <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center' }}>
        <button className="btn ghost sm" onClick={showAll} style={{ width: '100%', color: 'var(--color-primary)', fontWeight: 600 }}>
          Hiện tất cả các cột
        </button>
      </div>
    </CustomModal>
  );
};
