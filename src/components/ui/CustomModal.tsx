import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import styles from './CustomModal.module.css';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  width?: string | number;
  maxWidth?: string | number;
  size?: 'small' | 'medium' | 'large' | string;
  children: React.ReactNode;
  showCloseIcon?: boolean;
  disableAnimation?: boolean;
  headerAction?: React.ReactNode;
  zIndex?: number;
  fullScreenOnMobile?: boolean;
  modalClassName?: string;
}

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  title,
  width,
  maxWidth,
  children,
  showCloseIcon = true,
  disableAnimation = false,
  headerAction,
  zIndex,
  fullScreenOnMobile = false,
  modalClassName
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

  const [isMobile, setIsMobile] = React.useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resolvedWidth = React.useMemo(() => {
    const formatDimension = (val: string | number) => {
      if (typeof val === 'number') return `${val}px`;
      const str = String(val).trim();
      return /^\d+$/.test(str) ? `${str}px` : str;
    };

    if (maxWidth) return formatDimension(maxWidth);
    if (width) return formatDimension(width);
    return '800px';
  }, [width, maxWidth]);

  const motionProps = isMobile ? {
    initial: { y: '100%', opacity: 1 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 },
    transition: { type: 'spring' as const, damping: 28, stiffness: 240, mass: 0.8 }
  } : {
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: 8 },
    transition: { type: 'spring' as const, damping: 26, stiffness: 220 }
  };

  const dragProps = isMobile ? {
    drag: 'y' as const,
    dragDirectionLock: true,
    dragConstraints: { top: 0 },
    dragElastic: { top: 0.05, bottom: 0.65 },
    onDragEnd: (event: any, info: any) => {
      if (info.offset.y > 120 || info.velocity.y > 400) {
        onClose();
      }
    }
  } : {};

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        disableAnimation ? (
          <div className={`${styles.overlay} ${fullScreenOnMobile ? styles.fullscreenOverlay : ''}`} style={{ zIndex: zIndex || 2000000 }}>
            <div
              className={styles.backdrop}
              onClick={onClose}
            />

            <div
              className={`${styles.modal} ${fullScreenOnMobile ? styles.fullScreenMobile : ''} ${modalClassName || ''}`}
              style={{ width: isMobile ? '100vw' : '100%', maxWidth: isMobile ? '100vw' : resolvedWidth }}
            >
              <div className={styles.dragHandle} />
              {title && (
                <div className={styles.header}>
                  <h3 className={styles.title}>{title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {headerAction}
                    {showCloseIcon && (
                      <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                      </button>
                    )}
                  </div>
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
          <div className={`${styles.overlay} ${fullScreenOnMobile ? styles.fullscreenOverlay : ''}`} style={{ zIndex: zIndex || 2000000 }}>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />

            <motion.div
              className={`${styles.modal} ${fullScreenOnMobile ? styles.fullScreenMobile : ''} ${modalClassName || ''}`}
              style={{ width: isMobile ? '100vw' : '100%', maxWidth: isMobile ? '100vw' : resolvedWidth }}
              {...motionProps}
              {...dragProps}
            >
              <div className={styles.dragHandle} />
              {title && (
                <div className={styles.header}>
                  <h3 className={styles.title}>{title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {headerAction}
                    {showCloseIcon && (
                      <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                      </button>
                    )}
                  </div>
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
