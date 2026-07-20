import { motion } from 'framer-motion';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  small?: boolean;
  disabled?: boolean;
}

export const ToggleSwitch = ({ checked, onChange, small = false, disabled = false }: ToggleSwitchProps) => {
  const width = small ? 32 : 44;
  const height = small ? 18 : 24;
  const knobSize = small ? 14 : 20;

  return (
    <motion.div
      onClick={() => !disabled && onChange(!checked)}
      className="flex items-center select-none shrink-0"
      animate={{
        backgroundColor: checked ? 'var(--color-success)' : 'var(--color-border)'
      }}
      style={{
        width,
        height,
        borderRadius: 999,
        padding: '2px',
        position: 'relative',
        display: 'flex',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        border: '1px solid rgba(0,0,0,0.04)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1
      }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        layout
        transition={{
          type: "spring",
          stiffness: 700,
          damping: 35
        }}
        style={{
          width: knobSize,
          height: knobSize,
          borderRadius: 999,
          background: 'var(--color-surface)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.12)'
        }}
      />
    </motion.div>
  );
};
