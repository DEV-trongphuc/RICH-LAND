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

  const [isMobile, setIsMobile] = React.useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resolvedWidth = React.useMemo(() => {
    if (!width) return '800px';
    const num = parseInt(String(width), 10);
    if (!isNaN(num) && num < 680) {
      return '680px';
    }
    return width;
  }, [width]);

  const motionProps = isMobile ? {
    initial: { y: '100%', opacity: 1 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 1 },
    transition: { type: 'tween' as const, ease: [0.16, 1, 0.3, 1] as any, duration: 0.35 }
  } : {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 15 },
    transition: { type: "spring" as const, duration: 0.4, bounce: 0.12 }
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
          <div className={`${styles.overlay} ${fullScreenOnMobile ? styles.fullscreenOverlay : ''}`} style={zIndex ? { zIndex } : undefined}>
            <div
              className={styles.backdrop}
              onClick={onClose}
            />

            <div
              className={`${styles.modal} ${fullScreenOnMobile ? styles.fullScreenMobile : ''} ${modalClassName || ''}`}
              style={{ width: isMobile ? '100vw' : resolvedWidth, maxWidth: isMobile ? '100vw' : resolvedWidth }}
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
          <div className={`${styles.overlay} ${fullScreenOnMobile ? styles.fullscreenOverlay : ''}`} style={zIndex ? { zIndex } : undefined}>
            <motion.div
              className={styles.backdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />

            <motion.div
              className={`${styles.modal} ${fullScreenOnMobile ? styles.fullScreenMobile : ''} ${modalClassName || ''}`}
              style={{ width: isMobile ? '100vw' : resolvedWidth, maxWidth: isMobile ? '100vw' : resolvedWidth }}
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
