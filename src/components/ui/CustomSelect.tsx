import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import styles from './CustomSelect.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from './Avatar';
import { useLanguage } from '../../contexts/LanguageContext';

export interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  avatar?: string;
  sublabel?: string;
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
  multiple = false
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

  const handleSelect = (val: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
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
      <span className={styles.triggerContent}>
        {showAvatars && <Avatar src={selectedOption.avatar} name={t(selectedOption.label)} size="sm" />}
        {!showAvatars && selectedOption.icon && <span style={{ display: 'flex' }}>{selectedOption.icon}</span>}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>{t(selectedOption.label)}</span>
          {selectedOption.sublabel && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>({t(selectedOption.sublabel)})</span>}
        </span>
      </span>
    ) : t(placeholder);
  };

  return (
    <div className={styles.wrapper} ref={containerRef} style={{ width }}>
      {label && <label className={styles.label}>{t(label)}</label>}
      <div 
        className={`${styles.trigger} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={(multiple && Array.isArray(value) && value.length > 0) || selectedOption ? styles.selectedValue : styles.placeholder}>
          {renderTriggerContent()}
        </span>
        <ChevronDown size={16} className={`${styles.icon} ${isOpen ? styles.iconOpen : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: direction === 'down' ? -10 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction === 'down' ? -10 : 10 }}
            transition={{ duration: 0.15 }}
            className={styles.dropdown}
            style={{ 
              top: direction === 'down' ? 'calc(100% + 0.5rem)' : 'auto',
              bottom: direction === 'up' ? 'calc(100% + 0.5rem)' : 'auto',
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
            <div className={styles.list}>
              {filtered.length > 0 ? filtered.map((option) => (
                <div 
                  key={option.value}
                  className={`${styles.option} ${isSelected(option.value) ? styles.optionSelected : ''}`}
                  onClick={(e) => handleSelect(option.value, e)}
                >
                  <div className={styles.optionLabel}>
                    {showAvatars ? (
                      <Avatar src={option.avatar} name={t(option.label)} size="sm" />
                    ) : (
                      option.icon && <span style={{ display: 'flex' }}>{option.icon}</span>
                    )}
                    <div className={styles.optionText}>
                      <span className={styles.optionMainLabel}>{t(option.label)}</span>
                      {option.sublabel && <span className={styles.optionSublabel}>{t(option.sublabel)}</span>}
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

