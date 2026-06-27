import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, FileText, Settings, CreditCard, ChevronRight, CheckSquare, Phone, Activity, Package, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleAction = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  const results = [
    { title: 'Quản lý Liên hệ (Contacts)', icon: <User size={16}/>, action: () => handleAction('/contacts') },
    { title: 'Quản lý Pipeline', icon: <CreditCard size={16}/>, action: () => handleAction('/deals') },
    { title: 'Quản lý Sản phẩm', icon: <Package size={16}/>, action: () => handleAction('/products') },
    { title: 'Hóa đơn & Bán hàng', icon: <FileText size={16}/>, action: () => handleAction('/invoices') },
    { title: 'Hoạt động & Lịch (Activities)', icon: <Activity size={16}/>, action: () => handleAction('/activities') },
    { title: 'Báo cáo & Phân tích', icon: <BarChart3 size={16}/>, action: () => handleAction('/reports') },
    { title: 'Cài đặt hệ thống', icon: <Settings size={16}/>, action: () => handleAction('/settings') },
  ].filter(r => r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <AnimatePresence>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }}
            style={{ position: 'relative', width: '90%', maxWidth: '600px', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden', border: '1px solid var(--color-border)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <Search size={20} style={{ color: 'var(--color-text-muted)', marginRight: '1rem' }} />
              <input 
                ref={inputRef}
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm kiếm lệnh, tính năng... (VD: contacts)"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '1.125rem', color: 'var(--color-text)' }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontWeight: 600 }}>ESC</div>
            </div>
            
            <div style={{ padding: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {results.length > 0 ? (
                <>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '0.5rem 1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Điều hướng nhanh</div>
                  {results.map((r, i) => (
                    <div 
                      key={i} onClick={r.action}
                      style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 0.2s', color: 'var(--color-text)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text)'; }}
                    >
                      <div style={{ color: 'inherit', opacity: 0.8 }}>{r.icon}</div>
                      <span style={{ flex: 1, fontWeight: 500 }}>{r.title}</span>
                      <ChevronRight size={16} style={{ opacity: 0.3 }} />
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Không tìm thấy kết quả nào cho "{search}"
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
