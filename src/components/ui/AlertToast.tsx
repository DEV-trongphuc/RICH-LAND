import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import styles from './AlertToast.module.css';

const icons = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

export const AlertToast: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className={styles.container}>
      <AnimatePresence>
        {toasts.map(toast => {
          const Icon = icons[toast.type];
          return (
            <motion.div
              key={toast.id}
              className={`${styles.toast} ${styles[toast.type]}`}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0,  scale: 1 }}
              exit={{    opacity: 0, x: 80,  scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              layout
            >
              <Icon size={18} className={styles.icon} />
              <span className={styles.message}>{toast.message}</span>
              {toast.action && (
                <button 
                  className={styles.actionBtn} 
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                >
                  {toast.action.label}
                </button>
              )}
              <button className={styles.close} onClick={() => removeToast(toast.id)}>
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
