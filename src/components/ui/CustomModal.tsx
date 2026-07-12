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

  const [isMobile, setIsMobile] = React.useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resolvedWidth = React.useMemo(() => {
    if (!width) return '680px';
    const num = parseInt(String(width), 10);
    if (!isNaN(num) && num < 580) {
      return '580px';
    }
    return width;
  }, [width]);

  const motionProps = isMobile ? {
    initial: { y: '100%', opacity: 1 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 1 },
    transition: { type: 'spring', damping: 25, stiffness: 220 }
  } : {
    initial: { opacity: 0, scale: 0.95, y: 15 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 15 },
    transition: { type: "spring", duration: 0.4, bounce: 0.12 }
  };

  const dragProps = isMobile ? {
    drag: 'y' as const,
    dragConstraints: { top: 0 },
    dragElastic: 0.2,
    onDragEnd: (event: any, info: any) => {
      if (info.offset.y > 120 || info.velocity.y > 500) {
        onClose();
      }
    }
  } : {};

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
              style={{ width: isMobile ? '100vw' : resolvedWidth }}
            >
              <div className={styles.dragHandle} />
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

              <div className={`${styles.content} custom-scrollbar`}>
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
              style={{ width: isMobile ? '100vw' : resolvedWidth }}
              {...motionProps}
              {...dragProps}
            >
              <div className={styles.dragHandle} />
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

              <div className={`${styles.content} custom-scrollbar`}>
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
