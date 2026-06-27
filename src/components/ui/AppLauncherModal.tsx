import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, X, LayoutGrid } from 'lucide-react';

interface NavItem {
  to: string;
  icon: any;
  label: string;
}

interface AppLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavItem[];
}

export const AppLauncherModal: React.FC<AppLauncherModalProps> = ({ isOpen, onClose, items }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch('');
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredItems = items.filter(item => 
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="overlay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ zIndex: 1000 }}
          />
          <motion.div
            initial={isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.9, x: '-50%', y: '-40%' }}
            animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.9, x: '-50%', y: '-40%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: isMobile ? 'auto' : '50%',
              bottom: isMobile ? 0 : 'auto',
              left: isMobile ? 0 : '50%',
              width: isMobile ? '100%' : '900px',
              maxWidth: isMobile ? '100vw' : 'calc(100vw - 2rem)',
              background: 'var(--color-surface)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: isMobile ? '24px 24px 0 0' : '32px',
              boxShadow: 'var(--shadow-2xl)',
              border: '1px solid var(--color-border)',
              zIndex: 1001,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: isMobile ? '80vh' : 'auto'
            }}
          >
            {/* Header / Search */}
            <div style={{ padding: isMobile ? '1.25rem 1.25rem 1rem' : '2rem 2rem 1.5rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: isMobile ? '1rem' : '1.5rem' }}>
                <div style={{ width: isMobile ? 36 : 48, height: isMobile ? 36 : 48, borderRadius: isMobile ? '12px' : '16px', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.05)', flexShrink: 0 }}>
                  <img src="/LOGO.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Trình khởi chạy</h3>
                  <p style={{ fontSize: isMobile ? '0.75rem' : '0.875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{isMobile ? 'Truy cập nhanh chức năng' : 'Truy cập nhanh các chức năng hệ thống'}</p>
                </div>
                <button onClick={onClose} style={{ marginLeft: 'auto', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: isMobile ? '0.875rem' : '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm kiếm chức năng..."
                  style={{
                    width: '100%',
                    padding: isMobile ? '0.75rem 1rem 0.75rem 2.75rem' : '0.875rem 1rem 0.875rem 3rem',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                />
              </div>
            </div>

            {/* Grid Area */}
            <div style={{ padding: isMobile ? '1rem 1.25rem 1.25rem' : '1.5rem 2.5rem 2.5rem', maxHeight: isMobile ? '55vh' : '70vh', overflowY: 'auto' }} className="no-scrollbar">
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(90px, 1fr))' : 'repeat(auto-fill, minmax(140px, 1fr))', gap: isMobile ? '0.75rem' : '1.25rem' }}>
                {filteredItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.to}
                      whileHover={{ y: -4, scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelect(item.to)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: isMobile ? '0.5rem' : '0.75rem',
                        padding: isMobile ? '1rem 0.5rem' : '1.25rem 0.75rem',
                        borderRadius: isMobile ? '16px' : '20px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <div style={{ 
                        width: isMobile ? 38 : 44, 
                        height: isMobile ? 38 : 44, 
                        borderRadius: isMobile ? '10px' : '14px', 
                        background: 'linear-gradient(135deg, var(--color-primary), #a31422)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(163, 20, 34, 0.25)',
                        flexShrink: 0
                      }}>
                        <Icon size={isMobile ? 18 : 22} />
                      </div>
                      <span style={{ fontSize: isMobile ? '0.75rem' : '0.8125rem', fontWeight: 600, color: 'var(--color-text)', textAlign: 'center', wordBreak: 'break-word' }}>{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
              
              {filteredItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                  <Search size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Không tìm thấy chức năng nào phù hợp</p>
                </div>
              )}
            </div>
            
            <div style={{ padding: isMobile ? '0.75rem 1rem' : '1rem 2rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{isMobile ? 'Vuốt xuống hoặc chạm ngoài để đóng' : 'Nhấn ESC để đóng nhanh'}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
