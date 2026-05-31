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
  showCloseIcon?: boolean;
  disableAnimation?: boolean;
}

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  title,
  width,
  children,
  showCloseIcon = true,
  disableAnimation = false
}) => {
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
        disableAnimation ? (
          <div className={styles.overlay}>
            <div
              className={styles.backdrop}
              onClick={onClose}
            />

            <div
              className={styles.modal}
              style={width ? { width, maxWidth: '95vw' } : {}}
            >
              {title && (
                <div className={styles.header}>
                  <h3 className={styles.title}>{title}</h3>
                  {showCloseIcon && (
                    <button className={styles.closeBtn} onClick={onClose}>
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}
              {!title && showCloseIcon && (
                <button className={`${styles.closeBtn} ${styles.floatingClose}`} onClick={onClose}>
                  <X size={20} />
                </button>
              )}

              <div className={styles.content}>
                {children}
              </div>
            </div>
          </div>
        ) : (
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
              initial={{ opacity: 0, scale: 0.9, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 0 }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
            >
              {title && (
                <div className={styles.header}>
                  <h3 className={styles.title}>{title}</h3>
                  {showCloseIcon && (
                    <button className={styles.closeBtn} onClick={onClose}>
                      <X size={20} />
                    </button>
                  )}
                </div>
              )}
              {!title && showCloseIcon && (
                <button className={`${styles.closeBtn} ${styles.floatingClose}`} onClick={onClose}>
                  <X size={20} />
                </button>
              )}

              <div className={styles.content}>
                {children}
              </div>
            </motion.div>
          </div>
        )
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
