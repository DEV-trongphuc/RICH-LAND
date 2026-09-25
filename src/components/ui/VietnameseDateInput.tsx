import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

export interface VietnameseDateInputProps {
  value?: string | null; // ISO string 'yyyy-mm-dd' or 'yyyy-mm-dd hh:mm:ss'
  onChange: (isoDate: string) => void;
  className?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  hasLeftIcon?: boolean;
  leftIcon?: React.ReactNode;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  const maxDays = new Date(y, m, 0).getDate();
  return d >= 1 && d <= maxDays;
}

export const isoToVn = (isoStr?: string | null): string => {
  if (!isoStr) return '';
  const clean = String(isoStr).trim().substring(0, 10);
  if (clean === '0000-00-00' || clean === '00/00/0000' || clean === 'null' || clean === 'undefined') return '';
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    if (parts[0] === '0000' || parts[1] === '00' || parts[2] === '00') return '';
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  const vnMatch = clean.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/);
  if (vnMatch) {
    const d = parseInt(vnMatch[1], 10);
    const m = parseInt(vnMatch[2], 10);
    const y = parseInt(vnMatch[3], 10);
    if (d === 0 || m === 0 || y === 0) return '';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
  return '';
};

export const parseDateToIso = (rawStr: string): string | null => {
  if (!rawStr) return null;
  const trimmed = String(rawStr).trim();
  if (!trimmed || trimmed === '0000-00-00' || trimmed === '00/00/0000' || trimmed === 'null' || trimmed === 'undefined') return null;

  const isoMatch = trimmed.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidDate(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const vnMatch = trimmed.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/);
  if (vnMatch) {
    const d = parseInt(vnMatch[1], 10);
    const m = parseInt(vnMatch[2], 10);
    const y = parseInt(vnMatch[3], 10);
    if (isValidDate(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const digitsMatch = trimmed.match(/^(\d{8})$/);
  if (digitsMatch) {
    const d1 = parseInt(trimmed.substring(0, 2), 10);
    const m1 = parseInt(trimmed.substring(2, 4), 10);
    const y1 = parseInt(trimmed.substring(4, 8), 10);
    if (isValidDate(y1, m1, d1)) {
      return `${String(y1).padStart(4, '0')}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`;
    }
    const y2 = parseInt(trimmed.substring(0, 4), 10);
    const m2 = parseInt(trimmed.substring(4, 6), 10);
    const d2 = parseInt(trimmed.substring(6, 8), 10);
    if (isValidDate(y2, m2, d2)) {
      return `${String(y2).padStart(4, '0')}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
    }
  }

  const shortMatch = trimmed.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2})$/);
  if (shortMatch) {
    const d = parseInt(shortMatch[1], 10);
    const m = parseInt(shortMatch[2], 10);
    const yy = parseInt(shortMatch[3], 10);
    const curYY = new Date().getFullYear() % 100;
    const y = (yy <= curYY) ? (2000 + yy) : (1900 + yy);
    if (isValidDate(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const embeddedVn = trimmed.match(/(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})/);
  if (embeddedVn) {
    const d = parseInt(embeddedVn[1], 10);
    const m = parseInt(embeddedVn[2], 10);
    const y = parseInt(embeddedVn[3], 10);
    if (isValidDate(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
};

export const VietnameseDateInput: React.FC<VietnameseDateInputProps> = ({
  value,
  onChange,
  className = 'form-input',
  style,
  inputStyle,
  placeholder = 'DD/MM/YYYY',
  disabled = false,
  min,
  max,
  hasLeftIcon = false,
  leftIcon,
  id,
  name,
  autoFocus = false,
  required = false,
  size = 'md'
}) => {
  const isoValue = value ? String(value).substring(0, 10) : '';
  const [displayText, setDisplayText] = useState(() => isoToVn(isoValue));
  const hiddenDateRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayText(isoToVn(isoValue));
  }, [isoValue]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDisplayText(text);
    const parsed = parseDateToIso(text);
    if (parsed !== null) {
      onChange(parsed);
    } else if (text.trim() === '') {
      onChange('');
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData?.getData('text');
    if (!pasted) return;

    const parsed = parseDateToIso(pasted);
    if (parsed) {
      e.preventDefault();
      const vnDate = isoToVn(parsed);
      setDisplayText(vnDate);
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseDateToIso(displayText);
    if (parsed !== null && parsed !== '') {
      setDisplayText(isoToVn(parsed));
      onChange(parsed);
    } else if (displayText.trim() === '') {
      setDisplayText('');
      onChange('');
    } else {
      setDisplayText(isoToVn(isoValue));
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIso = e.target.value;
    onChange(newIso);
    setDisplayText(isoToVn(newIso));
  };

  const triggerPicker = () => {
    if (disabled) return;
    if (hiddenDateRef.current) {
      if (typeof (hiddenDateRef.current as any).showPicker === 'function') {
        try {
          (hiddenDateRef.current as any).showPicker();
          return;
        } catch (e) {
          // ignore
        }
      }
      hiddenDateRef.current.focus();
      hiddenDateRef.current.click();
    }
  };

  const showLeft = Boolean(leftIcon);
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const defaultHeight = isSm ? '28px' : isLg ? '42px' : '36px';
  const defaultFontSize = isSm ? '0.78rem' : isLg ? '0.95rem' : '0.85rem';
  const iconSize = isSm ? 13 : isLg ? 17 : 15;

  return (
    <div 
      style={{ 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center', 
        width: '100%',
        ...style 
      }}
    >
      {showLeft && (
        <div 
          style={{ 
            position: 'absolute', 
            left: '10px', 
            color: 'var(--color-text-muted)', 
            display: 'flex', 
            alignItems: 'center', 
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          {leftIcon}
        </div>
      )}

      <input
        ref={textInputRef}
        type="text"
        id={id}
        name={name}
        className={className}
        value={displayText}
        onChange={handleTextChange}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        required={required}
        style={{
          width: '100%',
          paddingLeft: showLeft ? '2.2rem' : (isSm ? '8px' : '12px'),
          height: inputStyle?.height || defaultHeight,
          fontSize: inputStyle?.fontSize || defaultFontSize,
          fontWeight: 650,
          borderRadius: isSm ? '6px' : '8px',
          border: '1px solid var(--color-border)',
          backgroundColor: disabled ? 'var(--color-bg-light)' : 'var(--color-surface)',
          color: 'var(--color-text)',
          ...inputStyle,
          paddingRight: inputStyle?.paddingRight || (isSm ? '28px' : '36px')
        }}
      />
      
      <input
        ref={hiddenDateRef}
        type="date"
        value={isoValue}
        onChange={handleNativeDateChange}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '2px',
          top: 0,
          bottom: 0,
          margin: 'auto 0',
          width: isSm ? '24px' : '28px',
          height: isSm ? '24px' : '28px',
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          zIndex: 2
        }}
      />

      <button
        type="button"
        tabIndex={-1}
        onClick={triggerPicker}
        disabled={disabled}
        title="Chọn ngày từ lịch"
        style={{
          position: 'absolute',
          right: isSm ? '4px' : '8px',
          top: 0,
          bottom: 0,
          margin: 'auto 0',
          width: isSm ? '22px' : '26px',
          height: isSm ? '22px' : '26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--color-text-muted, #64748b)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          zIndex: 1,
          borderRadius: '4px',
          transition: 'color 0.15s ease'
        }}
      >
        <Calendar size={iconSize} />
      </button>
    </div>
  );
};
