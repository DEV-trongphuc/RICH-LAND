import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  width?: string | number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  width = 220
}) => {
  const [visible, setVisible] = useState(false);

  // Position offset calculations
  const getStyles = (): React.CSSProperties => {
    const common: React.CSSProperties = {
      position: 'absolute',
      zIndex: 10000,
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-text)',
      border: '1px solid var(--color-border)',
      padding: '8px 12px',
      borderRadius: '8px',
      fontSize: '0.75rem',
      fontWeight: 500,
      boxShadow: 'var(--shadow-lg)',
      width: typeof width === 'number' ? `${width}px` : width,
      pointerEvents: 'none',
      transition: 'opacity 0.15s ease, transform 0.15s ease',
      whiteSpace: 'normal',
      lineHeight: '1.4',
    };

    switch (position) {
      case 'bottom':
        return {
          ...common,
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%) translateY(8px)',
        };
      case 'left':
        return {
          ...common,
          top: '50%',
          right: '100%',
          transform: 'translateY(-50%) translateX(-8px)',
        };
      case 'right':
        return {
          ...common,
          top: '50%',
          left: '100%',
          transform: 'translateY(-50%) translateX(8px)',
        };
      case 'top':
      default:
        return {
          ...common,
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%) translateY(-8px)',
        };
    }
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(!visible)}
    >
      {children || (
        <HelpCircle
          size={14}
          style={{
            color: 'var(--color-text-muted)',
            cursor: 'help',
            marginLeft: '4px',
            opacity: 0.75,
            transition: 'opacity 0.15s',
          }}
          className="hover-opacity-100"
        />
      )}
      
      {visible && (
        <div style={getStyles()}>
          {content}
        </div>
      )}
    </div>
  );
};
