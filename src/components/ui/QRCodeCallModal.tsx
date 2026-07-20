import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Smartphone, Copy } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { QRCodeCanvas } from 'qrcode.react';

export const QRCodeCallModal: React.FC = () => {
  const { callModal, closeCall } = useUIStore();
  const { isOpen, phone } = callModal;

  if (!isOpen) return null;

  // Generate tel link
  const telLink = `tel:${phone.replace(/\s+/g, '')}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000030,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '2rem'
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCall}
              style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)', zIndex: -1
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                width: '100%', maxWidth: 400, background: 'var(--color-surface)',
                borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-2xl)',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: '1.125rem', margin: 0, color: 'var(--color-text)' }}>Quét mã để gọi</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>{phone}</p>
                  </div>
                </div>
                <button onClick={closeCall} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '8px' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                <div style={{ 
                  width: 240, height: 240, margin: '0 auto 2rem', 
                  padding: '20px', background: '#ffffff', borderRadius: '24px',
                  border: '1px solid var(--color-border-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                }}>
                  <QRCodeCanvas
                    value={telLink}
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: "/favicon.ico",
                      x: undefined,
                      y: undefined,
                      height: 24,
                      width: 24,
                      excavate: true,
                    }}
                  />
                </div>

                <div className="alert-info" style={{ marginBottom: '2rem', textAlign: 'left', fontSize: '0.875rem' }}>
                  <p style={{ margin: 0 }}>Mở camera trên điện thoại của bạn để quét mã và thực hiện cuộc gọi nhanh chóng.</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(phone);
                      const { addToast } = useUIStore.getState();
                      addToast('Đã sao chép số điện thoại', 'success');
                    }}
                    className="btn primary" 
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '42px', borderRadius: '12px' }}
                  >
                    <Copy size={18} /> Sao chép số
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
