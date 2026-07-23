import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string | number;
  zIndex?: number;
  headerActions?: React.ReactNode;
  className?: string;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = '550px',
  zIndex = 1000100,
  headerActions,
  className = ''
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent background body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const resolvedWidth = useMemo(() => {
    if (typeof width === 'number') return `${width}px`;
    return width;
  }, [width]);

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex,
            display: 'flex',
            alignItems: isMobile ? 'flex-end' : 'stretch',
            justifyContent: isMobile ? 'center' : 'flex-end',
            pointerEvents: 'none'
          }}
        >
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              pointerEvents: 'auto'
            }}
          />

          {/* Drawer / Bottom Sheet Container */}
          <motion.div
            className={`custom-scrollbar ${className}`}
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{
              type: 'spring',
              damping: isMobile ? 30 : 32,
              stiffness: isMobile ? 260 : 300,
              mass: 0.8
            }}
            drag={isMobile ? 'y' : false}
            dragDirectionLock={isMobile}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (isMobile && (info.offset.y > 150 || info.velocity.y > 400)) {
                onClose();
              }
            }}
            style={{
              position: 'relative',
              width: isMobile ? '100%' : resolvedWidth,
              maxWidth: '100%',
              height: isMobile ? '92dvh' : '100vh',
              background: 'var(--color-surface)',
              borderLeft: isMobile ? 'none' : '1px solid var(--color-border)',
              borderRadius: isMobile ? '24px 24px 0 0' : '0px',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: zIndex + 1,
              pointerEvents: 'auto',
              outline: 'none',
              overflow: 'hidden'
            }}
          >
            {/* Mobile Drag Handle */}
            {isMobile && (
              <div
                style={{
                  width: '36px',
                  height: '5px',
                  background: 'var(--color-border)',
                  borderRadius: '999px',
                  margin: '12px auto 6px',
                  flexShrink: 0
                }}
              />
            )}

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile
                  ? '12px 20px 16px'
                  : '20px 24px 16px',
                borderBottom: '1px solid var(--color-border-light)',
                flexShrink: 0
              }}
            >
              <div>
                {title && (
                  <h3
                    style={{
                      fontSize: isMobile ? '1.05rem' : '1.2rem',
                      fontWeight: 800,
                      color: 'var(--color-text)',
                      margin: 0,
                      letterSpacing: '-0.01em'
                    }}
                  >
                    {title}
                  </h3>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {headerActions}
                <button
                  onClick={onClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-muted)',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg)';
                    e.currentTarget.style.color = 'var(--color-text)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-muted)';
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div
              className="custom-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: isMobile ? '16px 20px 48px' : '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                boxSizing: 'border-box'
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
