import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

export const GlobalConfirmModal: React.FC = () => {
  const { confirmModal, closeConfirm } = useUIStore();
  const { isOpen, title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', isDanger, impactInfo, requireWordMatch, onConfirm, onCancel } = confirmModal;
  const [matchInput, setMatchInput] = React.useState('');

  React.useEffect(() => {
    if (isOpen) setMatchInput('');
  }, [isOpen]);

  if (!isOpen) return null;

  const isLocked = !!(requireWordMatch && matchInput !== requireWordMatch);

  const handleConfirm = () => {
    if (isLocked) return;
    onConfirm();
    closeConfirm();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeConfirm();
  };

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.35)', backdropFilter: 'blur(8px)',
        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem'
      }} onClick={handleCancel}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--color-surface)', width: '100%', maxWidth: '420px',
            borderRadius: 'var(--radius-2xl)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid var(--color-border-light)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}
        >
          {/* Header & Content */}
          <div style={{ padding: '1.75rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: isDanger ? 'rgba(239, 68, 68, 0.08)' : 'rgba(163, 20, 34, 0.08)',
              border: isDanger ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(163, 20, 34, 0.2)',
              color: isDanger ? '#ef4444' : '#a31422',
              boxShadow: isDanger ? '0 0 12px rgba(239, 68, 68, 0.1)' : '0 0 12px rgba(163, 20, 34, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {isDanger ? <AlertTriangle size={20} /> : <Info size={20} />}
            </div>
            
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.375rem' }}>
                {title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', lineHeight: 1.45, marginBottom: '1rem' }}>
                {message}
              </p>

              {impactInfo && (
                <div style={{ 
                  background: 'rgba(245, 158, 11, 0.06)', 
                  border: '1px solid rgba(245, 158, 11, 0.15)', 
                  padding: '0.625rem 0.875rem', 
                  borderRadius: '8px',
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '1rem'
                }}>
                  <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>{impactInfo}</span>
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
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ 
            padding: '1rem 1.75rem', background: 'var(--color-bg)',
            borderTop: '1px solid var(--color-border-light)', display: 'flex', 
            justifyContent: 'flex-end', gap: '0.625rem'
          }}>
            <button 
              className="btn secondary sm"
              onClick={handleCancel}
              style={{ fontWeight: 600, padding: '6px 14px', borderRadius: '8px', fontSize: '0.8125rem' }}
            >
              {cancelText}
            </button>
            <button 
              className={`btn ${isDanger ? 'danger' : 'primary'} sm`}
              onClick={handleConfirm}
              disabled={isLocked}
              style={{ 
                minWidth: '90px', 
                opacity: isLocked ? 0.4 : 1,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8125rem'
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
