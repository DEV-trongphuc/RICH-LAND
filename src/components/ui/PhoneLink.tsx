import React from 'react';
import { Phone } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

interface PhoneLinkProps {
  phone: string;
  className?: string;
  style?: React.CSSProperties;
  showIcon?: boolean;
}

export const PhoneLink: React.FC<PhoneLinkProps> = ({ 
  phone, className = '', style = {}, showIcon = false 
}) => {
  const { showCall } = useUIStore();

  if (!phone) return <span style={{ color: 'var(--color-text-muted)', ...style }}>N/A</span>;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (window.innerWidth < 768) {
          window.location.href = `tel:${phone}`;
        } else {
          showCall(phone);
        }
      }}
      className={`phone-link ${className}`}
      style={{
        background: 'none', border: 'none', padding: 0,
        color: 'var(--color-primary)', fontWeight: 600,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
        textDecoration: 'none',
        ...style
      }}
      title="Click để gọi qua QR Code"
    >
      {showIcon && <Phone size={14} />}
      {phone}
    </button>
  );
};
