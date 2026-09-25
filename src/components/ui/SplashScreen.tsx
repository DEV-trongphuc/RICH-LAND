import React from 'react';

interface SplashScreenProps {
  statusText?: string;
  isFullPage?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  statusText = 'Đang tải dữ liệu...',
  isFullPage = false
}) => {
  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: isFullPage ? '100vh' : '360px',
        width: '100%',
        padding: '2rem 1rem',
        background: isFullPage 
          ? 'radial-gradient(ellipse at 50% 35%, #2a050c 0%, #140407 48%, #080305 100%)'
          : 'transparent',
        position: 'relative',
        userSelect: 'none',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Ambient Ring */}
        <div 
          style={{
            position: 'absolute',
            width: isFullPage ? '160px' : '120px',
            height: isFullPage ? '160px' : '120px',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -55%)',
            borderRadius: '50%',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            boxShadow: '0 0 35px rgba(244, 63, 94, 0.25)',
            pointerEvents: 'none'
          }} 
        />
        
        {/* Logo Image */}
        <div
          style={{
            width: isFullPage ? '100px' : '75px',
            height: isFullPage ? '100px' : '75px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.9) 0%, rgba(127, 29, 29, 0.9) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(189, 29, 45, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            animation: 'floatMascot 3s ease-in-out infinite'
          }}
        >
          <img 
            src="/imgs/logo-rich-land-viet-nam-trang.webp" 
            alt="RichLand" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Shadow Pulse */}
        <div 
          style={{
            width: isFullPage ? '75px' : '55px',
            height: '8px',
            background: 'radial-gradient(ellipse at center, rgba(244, 63, 94, 0.45) 0%, transparent 70%)',
            borderRadius: '50%',
            marginTop: '12px',
            animation: 'shadowPulse 3s ease-in-out infinite'
          }} 
        />
      </div>

      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {/* Glowing Progress Bar */}
        <div 
          style={{
            width: '140px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
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
              boxShadow: '0 0 12px rgba(255, 45, 85, 0.8)',
              animation: 'progressSlide 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite'
            }} 
          />
        </div>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fecdd3', textShadow: '0 0 8px rgba(244, 63, 94, 0.4)' }}>
          {statusText}
        </span>
      </div>
    </div>
  );
};
