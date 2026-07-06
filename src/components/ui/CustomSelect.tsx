import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import styles from './CustomSelect.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from './Avatar';
import { useLanguage } from '../../contexts/LanguageContext';
import toast from 'react-hot-toast';

export interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  avatar?: string;
  sublabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  disabledType?: 'round' | 'sale';
  badge?: {
    count: number;
    color?: string;
  };
}

interface CustomSelectProps {
  options: SelectOption[];
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  label?: string;
  searchable?: boolean;
  showAvatars?: boolean;
  width?: string | number;
  direction?: 'up' | 'down';
  multiple?: boolean;
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  label,
  searchable = false,
  showAvatars = false,
  width,
  direction = 'down',
  multiple = false,
  align = 'left',
  size = 'sm',
  disabled = false
}) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedOption = multiple ? null : options.find(opt => opt.value == value);
  const filtered = searchable ? options.filter(o =>
    t(o.label).toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel && t(o.sublabel).toLowerCase().includes(search.toLowerCase()))
  ) : options;

  const isSelected = (val: string | number) => {
    if (multiple) {
      return Array.isArray(value) && value.some(v => String(v) === String(val));
    }
    return value == val;
  };

  const handleSelect = (option: SelectOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (option.disabled) {
      const reason = option.disabledReason ||
        (option.disabledType === 'round' ? t('Vòng không hoạt động') :
          option.disabledType === 'sale' ? t('Sale không hoạt động') :
            t('Lựa chọn này không hoạt động'));
      toast.error(reason);
      return;
    }
    const val = option.value;
    if (multiple) {
      const arr = Array.isArray(value) ? [...value] : [];
      if (val === 'all') {
        onChange(['all']);
      } else {
        const hasVal = arr.some(v => String(v) === String(val));
        const newArr = hasVal
          ? arr.filter(v => String(v) !== String(val))
          : [...arr.filter(v => String(v) !== 'all'), val];
        if (newArr.length === 0) onChange(['all']);
        else onChange(newArr);
      }
    } else {
      onChange(val);
      setIsOpen(false);
      setSearch('');
    }
  };

  const renderTriggerContent = () => {
    if (multiple) {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length === 0 || arr.some(v => String(v) === 'all')) {
        const allOption = options.find(o => String(o.value) === 'all');
        return (
          <span className={styles.triggerContent}>
            {allOption?.icon && <span style={{ display: 'flex' }}>{allOption.icon}</span>}
            {allOption ? t(allOption.label) : t(placeholder)}
          </span>
        );
      }
      const selectedOpts = options.filter(o => arr.some(v => String(v) === String(o.value)));
      if (selectedOpts.length === 1) {
        return (
          <span className={styles.triggerContent}>
            {!showAvatars && selectedOpts[0].icon && <span style={{ display: 'flex' }}>{selectedOpts[0].icon}</span>}
            {t(selectedOpts[0].label)}
          </span>
        );
      }
      return <span className={styles.triggerContent}>{t('Đã chọn')} ({selectedOpts.length})</span>;
    }
    return selectedOption ? (
      <span className={styles.triggerContent} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {showAvatars && (
            selectedOption.value === '' ? (
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>?</div>
            ) : (
              <Avatar src={selectedOption.avatar} name={t(selectedOption.label)} size="sm" />
            )
          )}
          {!showAvatars && selectedOption.icon && <span style={{ display: 'flex' }}>{selectedOption.icon}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>{t(selectedOption.label)}</span>
            {selectedOption.sublabel && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>({t(selectedOption.sublabel)})</span>}
          </span>
        </span>
        {selectedOption.badge && selectedOption.badge.count > 0 && (
          <span style={{
            background: selectedOption.badge.color || 'var(--color-danger)',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '0.7rem',
            fontWeight: 700,
            minWidth: '18px',
            textAlign: 'center',
            lineHeight: 1,
            marginLeft: 'auto'
          }}>
            {selectedOption.badge.count}
          </span>
        )}
      </span>
    ) : t(placeholder);
  };

  return (
    <div className={styles.wrapper} ref={containerRef} style={{ width }}>
      {label && <label className={styles.label}>{t(label)}</label>}
      <div
        className={`${styles.trigger} ${isOpen ? styles.open : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.625 : 1,
          backgroundColor: disabled ? 'var(--color-bg-light)' : undefined,
          ...(size === 'sm' ? {
            minHeight: '38px',
            height: '38px',
            padding: '6px 12px',
            fontSize: '0.875rem',
            borderRadius: 'var(--radius-md)'
          } : {}),
          ...((size === 'sm' && isOpen) ? {
            boxShadow: '0 0 0 3px rgba(163, 20, 34, 0.1)'
          } : {})
        }}
      >
        <span className={(multiple && Array.isArray(value) && value.length > 0) || selectedOption ? styles.selectedValue : styles.placeholder}>
          {renderTriggerContent()}
        </span>
        <ChevronDown size={size === 'sm' ? 14 : 16} className={`${styles.icon} ${isOpen ? styles.iconOpen : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: direction === 'down' ? -18 : 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction === 'down' ? -18 : 18, scale: 0.96 }}
            transition={{ type: "spring", duration: 0.32, bounce: 0.05 }}
            className={styles.dropdown}
            style={{
              top: direction === 'down' ? 'calc(100% + 0.5rem)' : 'auto',
              bottom: direction === 'up' ? 'calc(100% + 0.5rem)' : 'auto',
              left: align === 'right' ? 'auto' : 0,
              right: align === 'right' ? 0 : 'auto',
              transformOrigin: direction === 'down' ? 'top' : 'bottom'
            }}
          >
            {searchable && (
              <div className={styles.searchBox}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  type="text"
                  autoFocus
                  placeholder={t("Tìm kiếm...")}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className={styles.searchInput}
                />
              </div>
            )}
            <div className={`${styles.list} custom-scrollbar`}>
              {filtered.length > 0 ? filtered.map((option) => (
                <div
                  key={option.value}
                  className={`${styles.option} ${isSelected(option.value) ? styles.optionSelected : ''} ${option.disabled ? styles.optionDisabled : ''}`}
                  onClick={(e) => handleSelect(option, e)}
                >
                  <div className={styles.optionLabel}>
                    {showAvatars ? (
                      option.value === '' ? (
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>?</div>
                      ) : (
                        <Avatar src={option.avatar} name={t(option.label)} size="sm" />
                      )
                    ) : (
                      option.icon && <span style={{ display: 'flex' }}>{option.icon}</span>
                    )}
                    <div className={styles.optionText} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between', flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className={styles.optionMainLabel}>{t(option.label)}</span>
                        {option.sublabel && <span className={styles.optionSublabel}>{t(option.sublabel)}</span>}
                      </div>
                      {option.badge && option.badge.count > 0 && (
                        <span style={{
                          background: option.badge.color || 'var(--color-danger)',
                          color: 'white',
                          borderRadius: '10px',
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          minWidth: '18px',
                          textAlign: 'center',
                          lineHeight: 1,
                          marginLeft: 'auto'
                        }}>
                          {option.badge.count}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected(option.value) && <Check size={14} className={styles.checkIcon} />}
                </div>
              )) : (
                <div className={styles.empty}>{t("Không tìm thấy")}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

