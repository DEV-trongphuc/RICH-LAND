import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import styles from './CustomModal.module.css';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: string | number;
  children: React.ReactNode;
}

export const CustomModal: React.FC<CustomModalProps> = ({ isOpen, onClose, title, width, children }) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.overlay}>
          <motion.div 
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          <motion.div 
            className={styles.modal}
            style={width ? { width, maxWidth: '95vw' } : {}}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
          >
            {title && (
              <div className={styles.header}>
                <h3 className={styles.title}>{title}</h3>
                <button className={styles.closeBtn} onClick={onClose}>
                  <X size={20} />
                </button>
              </div>
            )}
            {!title && (
              <button className={`${styles.closeBtn} ${styles.floatingClose}`} onClick={onClose}>
                <X size={20} />
              </button>
            )}
            
            <div className={styles.content}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
