import React from 'react';
import { createPortal } from 'react-dom';
import { useUIStore } from '../../store/uiStore';

interface LoadingModalProps {
  isOpen?: boolean;
  text?: string;
  subText?: string;
  badge?: string;
  isMaintenance?: boolean;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ 
  isOpen: propsIsOpen, 
  text: propsText, 
  subText: propsSubText,
  badge: propsBadge,
  isMaintenance = false
}) => {
  const storeLoading = useUIStore((s) => s.loadingModal);

  const isOpen = propsIsOpen !== undefined ? propsIsOpen : storeLoading.isOpen;
  const text = propsText || storeLoading.text || (isMaintenance ? 'Hệ Thống Đang Bảo Trì & Nâng Cấp' : 'Đang xử lý dữ liệu...');
  const subText = propsSubText || storeLoading.subText || (isMaintenance ? 'RichLand CRM đang tiến hành bảo trì nâng cấp và đồng bộ hóa cơ sở dữ liệu lớn. Hệ thống tạm khóa truy cập để bảo vệ an toàn dữ liệu. Vui lòng quay lại sau ít phút!' : 'Hệ thống đang đồng bộ và tính toán, vui lòng chờ trong giây lát');
  const badge = propsBadge || (isMaintenance ? '🛠️ CHẾ ĐỘ BẢO TRÌ HỆ THỐNG' : null);

  const handleAdminBypass = () => {
    const code = window.prompt('Nhập mã quản trị viên để mở khóa (Admin Bypass):');
    if (code === 'richland2026' || code === 'mtp2026') {
      localStorage.setItem('richland_maintenance_bypass', '1');
      window.location.reload();
    } else if (code) {
      alert('Mã quản trị viên không chính xác!');
    }
  };

  if (!isOpen) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483645,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 5, 8, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        padding: '1rem',
        contain: 'layout paint',
        willChange: 'opacity',
        transform: 'translate3d(0, 0, 0)',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(28, 20, 24, 0.96) 0%, rgba(15, 12, 14, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '2.25rem 2rem',
          maxWidth: '420px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(189, 29, 45, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          animation: 'modalSpring 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          position: 'relative',
          overflow: 'hidden',
          contain: 'layout',
          willChange: 'transform, opacity',
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {/* Top ambient glow light */}
        <div
          style={{
            position: 'absolute',
            top: -40,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '180px',
            height: '80px',
            background: 'radial-gradient(ellipse at center, rgba(189, 29, 45, 0.45) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        {badge && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(239, 68, 68, 0.16)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#fca5a5',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '1rem',
              boxShadow: '0 0 16px rgba(239, 68, 68, 0.2)'
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
            {badge}
          </div>
        )}

        {/* Multi-layered Animated Spinner Orb */}
        <div style={{ position: 'relative', width: '76px', height: '76px', marginBottom: '1.5rem', contain: 'strict' }}>
          {/* Outer pulsating ring */}
          <div
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: '2px solid rgba(189, 29, 45, 0.3)',
              animation: 'pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
              willChange: 'transform, opacity',
            }}
          />

          {/* Spinning Gradient Track */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: '#BD1D2D',
              borderRightColor: '#f43f5e',
              borderBottomColor: '#fbbf24',
              animation: 'spin 1.1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite',
              boxShadow: '0 0 20px rgba(189, 29, 45, 0.4)',
              willChange: 'transform',
            }}
          />

          {/* Inner Counter-spinning ring */}
          <div
            style={{
              position: 'absolute',
              inset: 8,
              borderRadius: '50%',
              border: '2px dashed rgba(255, 255, 255, 0.25)',
              animation: 'spin 3s linear infinite reverse',
              willChange: 'transform',
            }}
          />

          {/* Center Logo / Mascot Icon */}
          <div
            style={{
              position: 'absolute',
              inset: 14,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #BD1D2D 0%, #7f1d1d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(189, 29, 45, 0.5)',
              overflow: 'hidden'
            }}
          >
            <img 
              src="/imgs/logo-rich-land-viet-nam-trang.webp" 
              alt="RichLand" 
              style={{ width: '24px', height: '24px', objectFit: 'contain' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Text Area */}
        <h3
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '1.1rem',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {text}
        </h3>

        {subText && (
          <p
            style={{
              margin: '0 0 1.25rem 0',
              fontSize: '0.8rem',
              lineHeight: 1.4,
              color: 'rgba(255, 255, 255, 0.65)',
              maxWidth: '300px'
            }}
          >
            {subText}
          </p>
        )}

        {/* Shimmering Progress Bar */}
        <div
          style={{
            width: '180px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 0 8px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #BD1D2D, #f43f5e, #fbbf24, #BD1D2D)',
              backgroundSize: '200% 100%',
              borderRadius: '10px',
              boxShadow: '0 0 12px rgba(189, 29, 45, 0.8)',
              animation: 'progressSlide 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
              willChange: 'left',
            }}
          />
        </div>

        {isMaintenance && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.45)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⏳ Trạng thái: Đang bảo trì nâng cấp</span>
              <span>•</span>
              <span>Dự kiến: Ít phút</span>
            </div>
            <button
              type="button"
              onClick={handleAdminBypass}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.25)',
                fontSize: '0.68rem',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: '4px 8px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.25)')}
            >
              Quản trị viên (Bypass)
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
