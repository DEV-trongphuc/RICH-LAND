import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  faded?: boolean;
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
  avatarsOnly?: boolean;
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
  avatarsOnly = false,
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownDirection, setDropdownDirection] = useState<'up' | 'down'>(direction);
  const [portalCoords, setPortalCoords] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
  }>({ top: 0, bottom: 0, left: 0, right: 0, width: 220 });

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const resolvedDir = spaceBelow < 260 && spaceAbove > spaceBelow ? 'up' : direction;
    setDropdownDirection(resolvedDir);
    setPortalCoords({
      top: rect.bottom + 6,
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
      right: window.innerWidth - rect.right,
      width: rect.width
    });
  }, [direction]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    const handleScrollOrResize = (e: Event) => {
      if (dropdownRef.current && e.target instanceof Node && dropdownRef.current.contains(e.target)) {
        return;
      }
      updateDropdownPosition();
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateDropdownPosition]);

  const selectedOption = React.useMemo(() => {
    if (multiple) return null;
    return options.find(opt => opt.value == value);
  }, [options, value, multiple]);

  const filtered = React.useMemo(() => {
    if (!searchable) return options;
    const searchLower = (search || '').toLowerCase();
    
    // For small lists, do simple filter
    if (options.length <= 100) {
      return options.filter(o => {
        const labelStr = o.label ? String(o.label) : '';
        const sublabelStr = o.sublabel ? String(o.sublabel) : '';
        const translatedLabel = t(labelStr) || '';
        const translatedSublabel = t(sublabelStr) || '';
        return translatedLabel.toLowerCase().includes(searchLower) ||
          (o.sublabel && translatedSublabel.toLowerCase().includes(searchLower));
      });
    }

    // For large lists, optimize performance by exiting early after 100 matches
    const result = [];
    for (const o of options) {
      const labelStr = o.label ? String(o.label) : '';
      const sublabelStr = o.sublabel ? String(o.sublabel) : '';
      const translatedLabel = t(labelStr) || '';
      const translatedSublabel = t(sublabelStr) || '';
      
      const isMatch = translatedLabel.toLowerCase().includes(searchLower) ||
        (o.sublabel && translatedSublabel.toLowerCase().includes(searchLower));
        
      if (isMatch) {
        result.push(o);
        if (result.length >= 100) break;
      }
    }
    return result;
  }, [options, search, searchable, t]);

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
      if (selectedOpts.length > 0) {
        if (avatarsOnly) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', padding: '2px 0' }}>
              {selectedOpts.map(opt => (
                <div
                  key={String(opt.value)}
                  title={t(opt.label)}
                  style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(opt, e);
                  }}
                >
                  {opt.avatar ? (
                    <Avatar src={opt.avatar} name={t(opt.label)} size={26} />
                  ) : opt.icon ? (
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'var(--color-primary-light, #eff6ff)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--color-border-light)'
                    }}>
                      {opt.icon}
                    </div>
                  ) : (
                    <Avatar name={t(opt.label)} size={26} />
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      top: '-3px',
                      right: '-3px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px solid var(--color-surface, #ffffff)',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
                    }}
                  >
                    ×
                  </span>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center', width: '100%', padding: '2px 0' }}>
            {selectedOpts.map(opt => (
              <span
                key={String(opt.value)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: showAvatars ? '2px 10px 2px 4px' : '3px 10px',
                  borderRadius: '20px',
                  background: 'var(--color-bg-light, #f8fafc)',
                  border: '1px solid var(--color-border-light, #e2e8f0)',
                  color: 'var(--color-text, #0f172a)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
              >
                {showAvatars ? (
                  opt.avatar ? (
                    <Avatar src={opt.avatar} name={t(opt.label)} size={20} />
                  ) : opt.icon ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{opt.icon}</span>
                  ) : (
                    <Avatar name={t(opt.label)} size={20} />
                  )
                ) : (
                  opt.icon && <span style={{ display: 'flex', fontSize: '12px' }}>{opt.icon}</span>
                )}
                <span style={{ color: 'var(--color-text, #0f172a)', fontWeight: 600 }}>{t(opt.label)}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(opt, e);
                  }}
                  style={{
                    cursor: 'pointer',
                    color: 'var(--color-text-muted, #64748b)',
                    marginLeft: '2px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--color-danger)';
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--color-text-muted, #64748b)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        );
      }
    }
    return selectedOption ? (
      <span className={styles.triggerContent} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between', minWidth: 0, overflow: 'hidden' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', flex: 1 }}>
          {showAvatars && (
            selectedOption.value === '' ? (
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>?</div>
            ) : (
              <Avatar src={selectedOption.avatar} name={t(selectedOption.label)} size="sm" />
            )
          )}
          {!showAvatars && selectedOption.icon && <span style={{ display: 'flex' }}>{selectedOption.icon}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>{t(selectedOption.label)}</span>
            {selectedOption.sublabel && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>({t(selectedOption.sublabel)})</span>}
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
    <div 
      className={`${styles.wrapper} ${isOpen ? `${styles.open} open` : ''} custom-select-wrapper`} 
      ref={containerRef} 
      style={{ width, maxWidth: '100%', zIndex: isOpen ? 1000 : undefined }}
    >
      {label && <label className={styles.label}>{t(label)}</label>}
      <div
        className={`${styles.trigger} ${isOpen ? styles.open : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.625 : 1,
          backgroundColor: disabled ? 'var(--color-bg-light)' : undefined,
          maxWidth: '100%',
          overflow: 'hidden',
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

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: dropdownDirection === 'down' ? -12 : 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: dropdownDirection === 'down' ? -12 : 12, scale: 0.98 }}
              transition={{ type: "spring", duration: 0.28, bounce: 0.05 }}
              className={styles.dropdown}
              style={{
                position: 'fixed',
                top: dropdownDirection === 'down' ? `${portalCoords.top}px` : 'auto',
                bottom: dropdownDirection === 'up' ? `${portalCoords.bottom}px` : 'auto',
                left: align === 'right' ? 'auto' : `${portalCoords.left}px`,
                right: align === 'right' ? `${portalCoords.right}px` : 'auto',
                minWidth: `${Math.max(180, portalCoords.width)}px`,
                maxWidth: 'min(380px, 92vw)',
                zIndex: 2147483646,
                transformOrigin: dropdownDirection === 'down' ? 'top' : 'bottom'
              }}
            >
              {searchable && (
                <div className={styles.searchBox}>
                  <input
                    type="text"
                    autoFocus
                    placeholder={t("Tìm kiếm...")}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className={styles.searchInput}
                  />
                  <Search size={14} className={styles.searchIcon} />
                </div>
              )}
              <div className={`${styles.list} custom-scrollbar`}>
                {filtered.length > 0 ? filtered.map((option) => (
                  <div
                    key={option.value}
                    className={`${styles.option} ${isSelected(option.value) ? styles.optionSelected : ''} ${option.disabled ? styles.optionDisabled : ''}`}
                    style={{ opacity: option.faded ? 0.45 : 1 }}
                    onClick={(e) => handleSelect(option, e)}
                  >
                    <div className={styles.optionLabel}>
                      {showAvatars ? (
                        option.value === '' ? (
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>?</div>
                        ) : option.icon ? (
                          <span style={{ display: 'flex', flexShrink: 0 }}>{option.icon}</span>
                        ) : (
                          <Avatar src={option.avatar} name={t(option.label)} size="sm" />
                        )
                      ) : (
                        option.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{option.icon}</span>
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
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

