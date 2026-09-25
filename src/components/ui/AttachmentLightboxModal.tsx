import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ExternalLink, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

export interface AttachmentItem {
  url: string;
  name?: string;
  type?: 'image' | 'pdf' | 'other';
}

export interface AttachmentLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: AttachmentItem[];
  initialIndex?: number;
}

export const AttachmentLightboxModal: React.FC<AttachmentLightboxModalProps> = ({
  isOpen,
  onClose,
  items,
  initialIndex = 0
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) {
      const validIndex = Math.max(0, Math.min(initialIndex, items.length - 1));
      setCurrentIndex(validIndex);
    }
  }, [isOpen, initialIndex, items.length]);

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  }, [items.length]);

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  }, [items.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (typeof document === 'undefined') return null;

  const validIndex = Math.max(0, Math.min(currentIndex, items.length - 1));
  const current = items[validIndex];

  const isPdf = (item?: AttachmentItem) => {
    if (!item) return false;
    if (item.type === 'pdf') return true;
    if (item.type === 'image') return false;
    return /\.pdf($|\?)/i.test(item.url) || (item.name ? /\.pdf$/i.test(item.name) : false);
  };

  const handleDownload = async (item: AttachmentItem) => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = item.name || item.url.split('/').pop()?.split('?')[0] || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      const link = document.createElement('a');
      link.href = item.url;
      link.download = item.name || item.url.split('/').pop()?.split('?')[0] || 'attachment';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && current && (
        <motion.div
          key="attachment-lightbox-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483640,
            background: 'rgba(0, 0, 0, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            userSelect: 'none'
          }}
          onClick={onClose}
        >
          {/* Top Bar Header */}
          <div
            style={{
              position: 'fixed',
              top: '16px',
              left: '20px',
              right: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
              zIndex: 20,
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '70%' }}>
              <span
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: '#f8fafc',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}
                title={current.name || current.url}
              >
                {current.name || current.url.split('/').pop()?.split('?')[0] || 'Tài liệu đính kèm'}
              </span>

              {items.length > 1 && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(6px)',
                    color: '#ffffff',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                  }}
                >
                  {validIndex + 1} / {items.length}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleDownload(current)}
                title="Tải về máy"
                style={{
                  background: 'rgba(255, 255, 255, 0.16)',
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
                  e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Download size={18} />
              </button>

              <a
                href={current.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Mở trong thẻ mới"
                style={{
                  background: 'rgba(255, 255, 255, 0.16)',
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
                  e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <ExternalLink size={17} />
              </a>

              <button
                type="button"
                onClick={onClose}
                title="Đóng (Esc)"
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)';
                  e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <X size={19} />
              </button>
            </div>
          </div>

          {/* Navigation Prev Button */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              title="Ảnh trước (Mũi tên trái)"
              style={{
                position: 'fixed',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20,
                background: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* Navigation Next Button */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              title="Ảnh tiếp theo (Mũi tên phải)"
              style={{
                position: 'fixed',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20,
                background: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            >
              <ChevronRight size={28} />
            </button>
          )}

          {/* Center Main Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`lightbox-content-${validIndex}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'relative',
                maxWidth: '94vw',
                maxHeight: '84vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isPdf(current) ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: 'min(94vw, 1050px)',
                    height: '82vh',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    background: '#ffffff'
                  }}
                >
                  <iframe
                    src={current.url}
                    title={current.name || 'Tài liệu PDF'}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      display: 'block'
                    }}
                  />
                </div>
              ) : current.type === 'other' ? (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '16px',
                    padding: '2.5rem 3rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                    color: '#ffffff',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                    maxWidth: '480px',
                    textAlign: 'center'
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff'
                    }}
                  >
                    <FileText size={36} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700 }}>
                      {current.name || 'Tập tin đính kèm'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                      Định dạng tệp này không hỗ trợ xem trực tiếp. Vui lòng tải về máy để mở.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(current)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--color-primary, #BD1D2D)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 20px',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: '8px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
                    }}
                  >
                    <Download size={16} /> Tải tệp về máy
                  </button>
                </div>
              ) : (
                <img
                  src={current.url}
                  alt={current.name || 'Hình ảnh'}
                  style={{
                    maxWidth: '92vw',
                    maxHeight: '82vh',
                    objectFit: 'contain',
                    borderRadius: '12px',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    display: 'block'
                  }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.tried) {
                      target.dataset.tried = '1';
                      if (!current.url.startsWith('http') && !current.url.startsWith('/backend')) {
                        target.src = `/backend/${current.url.replace(/^\/?/, '')}`;
                      }
                    }
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom Dots Indicator */}
          {items.length > 1 && (
            <div
              style={{
                position: 'fixed',
                bottom: '18px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                padding: '6px 14px',
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                zIndex: 20,
                maxWidth: '90vw',
                overflowX: 'auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((item, idx) => (
                <button
                  key={`dot-${idx}`}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  title={item.name || `Mục ${idx + 1}`}
                  style={{
                    width: idx === validIndex ? '26px' : '8px',
                    height: '8px',
                    borderRadius: '999px',
                    background: idx === validIndex ? 'var(--color-primary, #BD1D2D)' : 'rgba(255, 255, 255, 0.38)',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
