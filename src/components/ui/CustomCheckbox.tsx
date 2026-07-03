import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (e: any) => void;
  label?: React.ReactNode;
  id?: string;
  disabled?: boolean;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ checked, onChange, label, id, disabled }) => {
  return (
    <label 
      className={`flex items-center gap-2 select-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      htmlFor={id}
    >
      <div style={{ position: 'relative', width: 18, height: 18 }}>
        <input 
          type="checkbox" 
          id={id}
          checked={checked} 
          onChange={disabled ? undefined : onChange} 
          disabled={disabled}
          style={{ 
            opacity: 0, 
            position: 'absolute', 
            width: '100%', 
            height: '100%', 
            cursor: disabled ? 'not-allowed' : 'pointer',
            margin: 0,
            zIndex: 1
          }} 
        />
        <motion.div
          animate={{ 
            backgroundColor: checked ? (disabled ? 'var(--color-border)' : 'var(--color-primary)') : 'var(--color-surface)',
            borderColor: checked ? (disabled ? 'var(--color-border)' : 'var(--color-primary)') : 'var(--color-border)',
            opacity: disabled ? 0.6 : 1
          }}
          style={{
            width: 18,
            height: 18,
            border: '2px solid',
            borderRadius: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s, border-color 0.2s'
          }}
        >
          <AnimatePresence>
            {checked && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              >
                <Check size={12} color="white" strokeWidth={4} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      {label && <span style={{ fontSize: '0.875rem', fontWeight: 500, opacity: disabled ? 0.6 : 1 }}>{label}</span>}
    </label>
  );
};
