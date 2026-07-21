import React, { useRef, useMemo } from 'react';

interface DigitPinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const DigitPinInput: React.FC<DigitPinInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const digits = useMemo(() => {
    const arr = value.split('').slice(0, length);
    while (arr.length < length) arr.push('');
    return arr;
  }, [value, length]);

  const handleChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, '');
    if (!cleanVal) {
      const newDigits = [...digits];
      newDigits[index] = '';
      onChange(newDigits.join(''));
      return;
    }
    const char = cleanVal.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    const result = newDigits.join('');
    onChange(result);

    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      onChange(pasted);
      const nextIndex = Math.min(pasted.length, length - 1);
      inputsRef.current[nextIndex]?.focus();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '10px 0' }}>
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => { inputsRef.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          style={{
            width: '42px',
            height: '46px',
            textAlign: 'center',
            fontSize: '1.15rem',
            fontWeight: '700',
            borderRadius: '8px',
            border: digit ? '1px solid var(--color-primary)' : '1px solid var(--color-border-light)',
            background: 'var(--color-bg-alt)',
            color: 'var(--color-text)',
            outline: 'none',
            boxShadow: digit ? '0 0 0 2px rgba(189, 29, 45, 0.06)' : 'none',
            transition: 'all 0.15s ease'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--color-primary)';
            e.target.style.boxShadow = '0 0 0 2px rgba(189, 29, 45, 0.06)';
          }}
          onBlur={(e) => {
            if (!e.target.value) {
              e.target.style.borderColor = 'var(--color-border-light)';
              e.target.style.boxShadow = 'none';
            }
          }}
        />
      ))}
    </div>
  );
};
