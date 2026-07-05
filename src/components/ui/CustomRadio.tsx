import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomRadioProps {
  checked: boolean;
  onChange: () => void;
  label?: React.ReactNode;
  name?: string;
}

export const CustomRadio: React.FC<CustomRadioProps> = ({ checked, onChange, label, name }) => {
  return (
    <label 
      className="flex items-center gap-2 cursor-pointer select-none"
      onClick={(e) => { e.preventDefault(); onChange(); }}
    >
      <div style={{ position: 'relative', width: 18, height: 18 }}>
        <input 
          type="radio" 
          checked={checked} 
          onChange={() => {}} 
          name={name}
          style={{ 
            opacity: 0, 
            position: 'absolute', 
            width: '100%', 
            height: '100%', 
            cursor: 'pointer',
            margin: 0,
            zIndex: 1
          }} 
        />
        <motion.div
          animate={{ 
            borderColor: checked ? 'var(--color-primary)' : 'var(--color-border)',
            boxShadow: checked ? '0 0 0 3px var(--color-primary-glow)' : 'none'
          }}
          style={{
            width: 18,
            height: 18,
            border: '2px solid',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-surface)',
            transition: 'border-color var(--transition), box-shadow var(--transition)'
          }}
        >
          <AnimatePresence>
            {checked && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 600,
                  damping: 22
                }}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary)'
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      {label && <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{label}</span>}
    </label>
  );
};
