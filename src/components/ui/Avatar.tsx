import React from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: number | 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  color?: string;
  aiScreened?: boolean;
}

const cleanNameForAvatar = (name: string) => {
  if (!name) return '';
  // Remove brackets, parentheses and their contents, e.g. [E2E] or (VIP)
  const cleaned = name.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');
  return cleaned.replace(/\s+/g, ' ').trim();
};

const getInitials = (name: string) => {
  const cleaned = cleanNameForAvatar(name);
  if (!cleaned) return '?';
  const parts = cleaned.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return cleaned[0].toUpperCase();
};

const getColorFromName = (name: string) => {
  const colors = [
    '#007AFF', // iOS Blue
    '#34C759', // iOS Green
    '#FF9500', // iOS Orange
    '#FF2D55', // iOS Pink
    '#5856D6', // iOS Purple
    '#AF52DE', // iOS Indigo
    '#5AC8FA', // iOS Teal
    '#FFCC00', // iOS Yellow
    '#10b981', // Emerald
    '#6366f1', // Indigo Blue
    '#a855f7', // Light Purple
    '#ec4899', // Rose Pink
    '#14b8a6', // Dark Teal
    '#f43f5e', // Coral Rose
    '#84cc16', // Lime Green
    '#0ea5e9', // Sky Blue
  ];
  const cleaned = cleanNameForAvatar(name);
  if (!cleaned) return colors[0];
  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) {
    hash = cleaned.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '', style, title, color, aiScreened }) => {
  const [hasError, setHasError] = React.useState(false);
  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
  };
  const finalSize = typeof size === 'number' ? size : sizeMap[size];
  const initials = name ? getInitials(name) : '?';
  const bgColor = color ? color : (name ? getColorFromName(name) : 'var(--color-primary)');

  let resolvedSrc = src;
  if (src && src.startsWith('uploads/')) {
    const apiBase = import.meta.env.VITE_API_URL || '/backend';
    resolvedSrc = `${apiBase}/${src}`;
  }

  // Nếu name là "Hệ thống" / "System" / "HT" và không có ảnh avatar cụ thể, gán ảnh LOGO mặc định
  if (!resolvedSrc && name) {
    const trimmedName = name.trim().toLowerCase();
    if (trimmedName === 'hệ thống' || trimmedName === 'system' || trimmedName === 'ht') {
      resolvedSrc = '/LOGO.jpg';
    }
  }

  // Reset error state if resolvedSrc changes
  React.useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  const avatarEl = (
    <div 
      className={`${styles.avatar} ${className}`}
      title={title}
      style={{ 
        width: finalSize, 
        height: finalSize, 
        fontSize: finalSize * 0.4,
        backgroundColor: resolvedSrc && !hasError ? 'transparent' : bgColor,
        ...style 
      }}
    >
      {resolvedSrc && !hasError ? (
        <img 
          src={resolvedSrc} 
          alt={name} 
          className={styles.image} 
          onError={() => setHasError(true)} 
        />
      ) : (
        <span className={styles.initials}>{initials}</span>
      )}
    </div>
  );

  if (aiScreened) {
    const badgeSize = Math.max(14, Math.floor(finalSize * 0.48));
    return (
      <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
        {avatarEl}
        <img
          src="/LOGO.jpg"
          alt="AI Evaluation"
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            border: '1.5px solid var(--color-surface, #ffffff)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            zIndex: 1,
            backgroundColor: 'var(--color-surface)',
            objectFit: 'cover'
          }}
        />
      </div>
    );
  }

  return avatarEl;
};
