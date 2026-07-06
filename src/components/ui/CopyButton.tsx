import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, className = '', size = 14, style }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t('Đã sao chép vào bộ nhớ tạm!'), { id: 'copy-toast' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(t('Không thể sao chép'));
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        padding: '4px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: copied ? 'var(--color-success, #10b981)' : 'var(--color-text-muted, #8e8e93)',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        verticalAlign: 'middle',
        marginLeft: '4px',
        ...style
      }}
      className={className}
      title={copied ? t('Đã sao chép!') : t('Sao chép')}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
};
