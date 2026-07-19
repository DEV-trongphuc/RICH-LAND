import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

export const GlobalConfirmModal: React.FC = () => {
  const { confirmModal, closeConfirm } = useUIStore();
  const { isOpen, title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', extraText, isDanger, impactInfo, requireWordMatch, requirePromptInput, promptPlaceholder, onConfirm, onCancel, onExtra } = confirmModal;
  const [matchInput, setMatchInput] = React.useState('');
  const [promptInput, setPromptInput] = React.useState('');
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setMatchInput('');
      setPromptInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLocked = !!(requireWordMatch && matchInput !== requireWordMatch) || !!(requirePromptInput && !promptInput.trim());

  const handleConfirm = () => {
    if (isLocked) return;
    onConfirm(requirePromptInput ? promptInput : undefined);
    closeConfirm();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeConfirm();
  };

  const renderMessage = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} style={{ height: '8px' }} />;
      if (trimmed.startsWith('•')) {
        return (
          <div key={idx} style={{ display: 'flex', gap: '8px', marginTop: '6px', paddingLeft: '4px' }}>
            <span style={{ color: isDanger ? '#ef4444' : 'var(--color-primary)', fontWeight: 'bold', fontSize: '1rem', lineHeight: '1.2rem' }}>•</span>
            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-light)', lineHeight: 1.5 }}>
              {trimmed.substring(1).trim()}
            </span>
          </div>
        );
      }
      return (
        <p key={idx} style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', lineHeight: 1.5, margin: '0 0 8px 0' }}>
          {line}
        </p>
      );
    });
  };

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(4px)',
        zIndex: 10000000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem'
      }} onClick={handleCancel}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-surface)', width: '100%', maxWidth: '480px',
            borderRadius: '16px', 
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 8px 16px -8px rgba(0, 0, 0, 0.08)',
            border: '1px solid var(--color-border-light)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            position: 'relative'
          }}
        >
          {/* Close button top right */}
          <button 
            onClick={handleCancel}
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              zIndex: 10
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={16} />
          </button>

          {/* Header & Content */}
          <div style={isMobile ? {
            padding: '2rem 1.5rem 1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            width: '100%'
          } : {
            padding: '2rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1.25rem'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '12px', flexShrink: 0,
              background: isDanger ? 'rgba(239, 68, 68, 0.08)' : 'rgba(163, 20, 34, 0.08)',
              border: isDanger ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(163, 20, 34, 0.15)',
              color: isDanger ? '#ef4444' : 'var(--color-primary)',
              boxShadow: isDanger ? '0 0 16px rgba(239, 68, 68, 0.06)' : '0 0 16px rgba(163, 20, 34, 0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: isMobile ? '1rem' : 0
            }}>
              {isDanger ? <AlertTriangle size={22} /> : <Info size={22} />}
            </div>
            
            <div style={{
              flex: 1,
              paddingRight: isMobile ? 0 : '12px',
              width: isMobile ? '100%' : undefined,
              display: 'flex',
              flexDirection: 'column',
              alignItems: isMobile ? 'center' : 'flex-start',
              textAlign: isMobile ? 'center' : 'left'
            }}>
              <h3 style={{
                fontSize: isMobile ? '1.05rem' : '1.125rem',
                fontWeight: 800,
                color: 'var(--color-text)',
                marginBottom: '0.5rem',
                lineHeight: 1.3,
                textAlign: isMobile ? 'center' : 'left'
              }}>
                {title}
              </h3>
              
              <div style={{
                marginTop: '0.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMobile ? 'center' : 'flex-start',
                textAlign: isMobile ? 'center' : 'left',
                width: '100%'
              }}>
                {renderMessage(message)}
              </div>

              {impactInfo && (
                <div style={{ 
                  background: 'rgba(245, 158, 11, 0.04)', 
                  border: '1px solid rgba(245, 158, 11, 0.12)', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '10px',
                  display: 'flex',
                  gap: '8px',
                  marginTop: '1rem',
                  marginBottom: '0.5rem'
                }}>
                  <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600, lineHeight: 1.4 }}>{impactInfo}</span>
                </div>
              )}

              {requireWordMatch && (
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px' }}>
                    Nhập <span style={{ color: 'var(--color-danger)', fontFamily: 'monospace' }}>"{requireWordMatch}"</span> để xác nhận
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`Nhập ${requireWordMatch}...`}
                    value={matchInput}
                    onChange={(e) => setMatchInput(e.target.value)}
                    style={{ 
                      textAlign: 'center', 
                      letterSpacing: '0.05em', 
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      borderColor: matchInput === requireWordMatch ? 'var(--color-success)' : 'var(--color-border)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      width: '100%'
                    }}
                  />
                </div>
              )}

              {requirePromptInput && (
                <div style={{ marginTop: '1rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={promptPlaceholder || 'Nhập giá trị...'}
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    autoFocus
                    style={{ 
                      fontSize: '0.875rem',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      width: '100%',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                      outline: 'none'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && promptInput.trim()) {
                        handleConfirm();
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ 
            padding: isMobile ? '1rem 1.5rem' : '1.25rem 2rem', 
            background: 'var(--color-surface-hover, #f8fafc)',
            borderTop: '1px solid var(--color-border-light)', 
            display: 'flex', 
            justifyContent: isMobile ? 'center' : 'flex-end', 
            gap: '0.75rem'
          }}>
            {!isMobile && (
              <button 
                className="btn sm"
                onClick={handleCancel}
                style={{ 
                  fontWeight: 700, 
                  padding: '8px 16px', 
                  borderRadius: '10px', 
                  fontSize: '0.8125rem',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-light)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-bg-hover)';
                  e.currentTarget.style.color = 'var(--color-text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-bg)';
                  e.currentTarget.style.color = 'var(--color-text-light)';
                }}
              >
                {cancelText}
              </button>
            )}
            {extraText && (
              <button 
                className="btn outline sm"
                onClick={() => {
                  if (onExtra) onExtra();
                  closeConfirm();
                }}
                style={{ 
                  fontWeight: 700, 
                  padding: '8px 16px', 
                  borderRadius: '10px', 
                  fontSize: '0.8125rem', 
                  borderColor: 'var(--color-border)',
                  flex: isMobile ? 1 : 'none',
                  textAlign: 'center'
                }}
              >
                {extraText}
              </button>
            )}
            <button 
              className="btn sm"
              onClick={handleConfirm}
              disabled={isLocked}
              style={{ 
                minWidth: isMobile ? 'unset' : '100px', 
                flex: isMobile ? 1 : 'none',
                opacity: isLocked ? 0.4 : 1,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '0.8125rem',
                background: isDanger ? '#ef4444' : 'var(--color-primary)',
                borderColor: isDanger ? '#ef4444' : 'var(--color-primary)',
                color: 'white',
                boxShadow: isDanger ? '0 4px 12px rgba(239, 68, 68, 0.18)' : '0 4px 12px rgba(163, 20, 34, 0.18)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!isLocked && !isMobile) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = isDanger ? '0 6px 16px rgba(239, 68, 68, 0.25)' : '0 6px 16px rgba(163, 20, 34, 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLocked && !isMobile) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isDanger ? '0 4px 12px rgba(239, 68, 68, 0.18)' : '0 4px 12px rgba(163, 20, 34, 0.18)';
                }
              }}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
