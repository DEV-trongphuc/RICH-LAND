import React, { useState, useEffect } from 'react';
import { numberToText } from '../../utils/numberToText';

interface CurrencyInputProps {
  value: number | string;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  showTextHelper?: boolean;
}

export const parseCurrencyValue = (val: string | number | null | undefined): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val);
  }
  const str = String(val).trim();
  if (!str || str === '0' || str === '0.00') return 0;

  // Check for smart units like "50 tỷ", "50 ty", "50t", "500 tr", "200k"
  const tyMatch = str.toLowerCase().match(/^([\d.,]+)\s*(tỷ|ty|t|b|bil|billion)$/);
  if (tyMatch) {
    const numPart = parseFloat(tyMatch[1].replace(',', '.'));
    if (!isNaN(numPart)) return Math.round(numPart * 1000000000);
  }
  const trMatch = str.toLowerCase().match(/^([\d.,]+)\s*(triệu|trieu|tr|m|mil|million)$/);
  if (trMatch) {
    const numPart = parseFloat(trMatch[1].replace(',', '.'));
    if (!isNaN(numPart)) return Math.round(numPart * 1000000);
  }
  const kMatch = str.toLowerCase().match(/^([\d.,]+)\s*(nghìn|nghin|ngàn|ngan|k)$/);
  if (kMatch) {
    const numPart = parseFloat(kMatch[1].replace(',', '.'));
    if (!isNaN(numPart)) return Math.round(numPart * 1000);
  }

  // Check if it's a decimal format like '5000000000.00' from MySQL / API (exactly one dot followed by digits)
  if (/^-?\d+\.\d+$/.test(str)) {
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : Math.round(parsed);
  }

  // If it's formatted with thousand separators (dots or commas)
  const clean = str.replace(/[^0-9]/g, '');
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
};

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  className = 'form-input',
  style,
  disabled = false,
  required = false,
  id,
  showTextHelper = true
}) => {
  const [displayValue, setDisplayValue] = useState('');

  // Helper to format number with commas/dots
  const formatWithCommas = (val: string | number) => {
    const num = parseCurrencyValue(val);
    if (!num) return '';
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  // Synchronize internal display value with external value
  useEffect(() => {
    const num = parseCurrencyValue(value);
    if (num === 0) {
      setDisplayValue('');
    } else {
      const formatted = new Intl.NumberFormat('vi-VN').format(num);
      if (formatted !== displayValue) {
        setDisplayValue(formatted);
      }
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    
    // Allow empty inputs
    if (rawInput.trim() === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Check if the user typed text unit shortcuts like "50 tỷ", "50ty", "500tr", "100k"
    const parsedWithUnit = parseCurrencyValue(rawInput);
    if (parsedWithUnit > 0 && /[a-zA-Zà-ỹÀ-Ỹ]/.test(rawInput)) {
      if (parsedWithUnit > 9999999999999) return;
      setDisplayValue(new Intl.NumberFormat('vi-VN').format(parsedWithUnit));
      onChange(parsedWithUnit);
      return;
    }

    // Standard digit typing with thousand separators
    const numericString = rawInput.replace(/[^0-9]/g, '');
    if (numericString === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    const numericValue = parseInt(numericString, 10);
    
    // Avoid exceeding max value (9999 billion)
    if (numericValue > 9999999999999) return;

    setDisplayValue(new Intl.NumberFormat('vi-VN').format(numericValue));
    onChange(numericValue);
  };

  // Generate readable abbreviation: e.g. 1.2 tỷ, 150 triệu
  const getAbbreviation = (num: number): string => {
    if (num >= 1000000000) {
      const billVal = num / 1000000000;
      return `${parseFloat(billVal.toFixed(2))} tỷ`;
    }
    if (num >= 1000000) {
      const millVal = num / 1000000;
      return `${parseFloat(millVal.toFixed(2))} triệu`;
    }
    if (num >= 1000) {
      const kVal = num / 1000;
      return `${parseFloat(kVal.toFixed(2))}k`;
    }
    return '';
  };

  const rawNumericValue = parseCurrencyValue(displayValue);
  const vietnameseText = numberToText(rawNumericValue);
  const abbreviation = rawNumericValue > 0 ? getAbbreviation(rawNumericValue) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id={id}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          required={required}
          style={{ width: '100%', fontWeight: 600, ...style }}
        />
      </div>
      {showTextHelper && rawNumericValue > 0 && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-primary, #a31422)',
            fontWeight: 500,
            fontStyle: 'italic',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          {vietnameseText} {abbreviation ? `(${abbreviation})` : ''}
        </span>
      )}
    </div>
  );
};

