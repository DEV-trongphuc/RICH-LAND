import React from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: number | 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
};

const getColorFromName = (name: string) => {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '', style, title }) => {
  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
  };
  const finalSize = typeof size === 'number' ? size : sizeMap[size];
  const initials = name ? getInitials(name) : '?';
  const bgColor = name ? getColorFromName(name) : 'var(--color-primary)';

  return (
    <div 
      className={`${styles.avatar} ${className}`}
      title={title}
      style={{ 
        width: finalSize, 
        height: finalSize, 
        fontSize: finalSize * 0.4,
        backgroundColor: src ? 'transparent' : bgColor,
        ...style 
      }}
    >
      {src ? (
        <img src={src} alt={name} className={styles.image} />
      ) : (
        <span className={styles.initials}>{initials}</span>
      )}
    </div>
  );
};
