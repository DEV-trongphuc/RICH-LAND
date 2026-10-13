import React from 'react';
import { Phone } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useAuth } from '../../contexts/AuthContext';
import { maskPhoneNumber, canUserSeeFullPhone } from '../../utils/phoneHelper';

interface PhoneLinkProps {
  phone: string;
  className?: string;
  style?: React.CSSProperties;
  showIcon?: boolean;
  ownerId?: number | string | null;
  assignedTo?: number | string | null;
  takers?: any[];
  forceMask?: boolean;
}

export const PhoneLink: React.FC<PhoneLinkProps> = ({ 
  phone, className = '', style = {}, showIcon = false,
  ownerId, assignedTo, takers, forceMask
}) => {
  const { showCall } = useUIStore();
  const { user } = useAuth();

  if (!phone) return <span style={{ color: 'var(--color-text-muted)', ...style }}>N/A</span>;

  const canSee = !forceMask && canUserSeeFullPhone(user, ownerId, takers, assignedTo);
  const displayPhone = canSee ? phone : maskPhoneNumber(phone);

  if (!canSee) {
    return (
      <span 
        className={`phone-link-masked ${className}`}
        style={{
          color: 'var(--color-text-muted)', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          ...style
        }}
        title="Số điện thoại đã được ẩn để bảo mật"
      >
        {showIcon && <Phone size={14} style={{ opacity: 0.5 }} />}
        {displayPhone}
      </span>
    );
  }

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
      {displayPhone}
    </button>
  );
};
