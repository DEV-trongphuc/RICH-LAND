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

  // Helper to format number with commas
  const formatWithCommas = (val: string | number) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = String(val).replace(/[^0-9]/g, '');
    if (clean === '') return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(clean));
  };

  // Synchronize internal display value with external value
  useEffect(() => {
    if (value === undefined || value === null || value === 0 || value === '') {
      setDisplayValue('');
    } else {
      const cleanExternal = String(value).replace(/[^0-9]/g, '');
      const formatted = formatWithCommas(cleanExternal);
      if (formatted !== displayValue) {
        setDisplayValue(formatted);
      }
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    
    // Allow empty inputs
    if (rawInput === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Keep only numbers
    const numericString = rawInput.replace(/[^0-9]/g, '');
    if (numericString === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    const numericValue = parseInt(numericString, 10);
    
    // Avoid exceeding max value (9999 billion)
    if (numericValue > 9999999999999) return;

    setDisplayValue(formatWithCommas(numericValue));
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

  const rawNumericValue = parseInt(displayValue.replace(/[^0-9]/g, ''), 10) || 0;
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
