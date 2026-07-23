import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TabOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface OSLikeTabsProps {
  options: TabOption[];
  activeTab: string;
  onChange: (value: string) => void;
  className?: string;
  variant?: 'pill' | 'underline';
}

export const OSLikeTabs: React.FC<OSLikeTabsProps> = ({
  options,
  activeTab,
  onChange,
  className = '',
  variant = 'pill'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll the active tab into view on mobile if it overflows
  useEffect(() => {
    if (activeTabRef.current && containerRef.current) {
      const container = containerRef.current;
      const tab = activeTabRef.current;

      const containerScrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      const tabLeft = tab.offsetLeft;
      const tabWidth = tab.clientWidth;

      if (tabLeft < containerScrollLeft) {
        container.scrollTo({
          left: tabLeft - 16,
          behavior: 'smooth'
        });
      } else if (tabLeft + tabWidth > containerScrollLeft + containerWidth) {
        container.scrollTo({
          left: tabLeft + tabWidth - containerWidth + 16,
          behavior: 'smooth'
        });
      }
    }
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      className={`no-scrollbar ${className}`}
      style={{
        display: 'flex',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        WebkitOverflowScrolling: 'touch',
        padding: '4px',
        background: variant === 'pill' ? 'var(--color-bg)' : 'transparent',
        borderRadius: variant === 'pill' ? '12px' : '0px',
        borderBottom: variant === 'underline' ? '1px solid var(--color-border)' : 'none',
        gap: variant === 'pill' ? '4px' : '16px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {options.map((option) => {
        const isActive = option.value === activeTab;
        return (
          <button
            key={option.value}
            ref={isActive ? activeTabRef : null}
            onClick={() => onChange(option.value)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: variant === 'pill' ? '8px 16px' : '10px 4px',
              fontSize: '0.85rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive
                ? 'var(--color-primary)'
                : 'var(--color-text-light)',
              borderRadius: variant === 'pill' ? '8px' : '0px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              outline: 'none',
              transition: 'color 0.25s ease',
              flexShrink: 0,
              height: '36px',
              flexGrow: variant === 'pill' ? 1 : 0
            }}
          >
            {/* Sliding Pill Indicator */}
            {isActive && variant === 'pill' && (
              <motion.div
                layoutId="active-pill-bg"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--color-surface)',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.02)',
                  zIndex: 0
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30
                }}
              />
            )}

            {/* Sliding Underline Indicator */}
            {isActive && variant === 'underline' && (
              <motion.div
                layoutId="active-underline-bg"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'var(--color-primary)',
                  zIndex: 1
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30
                }}
              />
            )}

            {option.icon && (
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center' }}>
                {option.icon}
              </span>
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
