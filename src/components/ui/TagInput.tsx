import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TAG_COLORS = [
  '#BD1D2D', '#BD1D2D', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'
];

const getTagColor = (tag: string): string => {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length;
  return TAG_COLORS[Math.abs(h)];
};

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
  readOnly?: boolean;
  suggestions?: string[];
  restrictToSuggestions?: boolean; // When true: only allow picking from suggestions list
}

export const TagInput: React.FC<TagInputProps> = ({
  tags, onChange, maxTags = 10, placeholder = 'Chọn tag từ danh sách...', readOnly = false,
  suggestions = [], restrictToSuggestions = false
}) => {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (val: string) => {
    const t = val.trim();
    if (!t || tags.includes(t) || tags.length >= maxTags) return;
    // If restricted, only allow values that exist in suggestions
    if (restrictToSuggestions && suggestions.length > 0 && !suggestions.includes(t)) return;
    onChange([...tags, t]);
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    if (readOnly) return;
    onChange(tags.filter(t => t !== tag));
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      // If restricting to suggestions, only add if there's an exact match
      if (restrictToSuggestions) {
        const exactMatch = suggestions.find(s => s.toLowerCase() === input.toLowerCase());
        if (exactMatch) addTag(exactMatch);
        return;
      }
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const filteredSuggestions = suggestions.filter(s => 
    s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  );

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => !readOnly && inputRef.current?.focus()}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center',
          padding: '0.75rem 1rem', minHeight: 52,
          background: readOnly ? 'transparent' : 'white',
          border: readOnly ? 'none' : `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-xl)', cursor: readOnly ? 'default' : 'text',
          boxShadow: focused && !readOnly ? '0 0 0 4px var(--color-primary-light)' : 'var(--shadow-sm)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {tags.map(tag => {
          const color = getTagColor(tag);
          return (
            <motion.span 
              key={tag} 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: 'var(--radius-lg)',
                background: `${color}12`, color, border: `1px solid ${color}25`,
                fontSize: '0.8125rem', fontWeight: 700, lineHeight: 1.5,
                userSelect: 'none'
              }}
            >
              {tag}
              {!readOnly && (
                <button
                  onClick={e => { e.stopPropagation(); removeTag(tag); }}
                  style={{ 
                    background: 'none', border: 'none', cursor: 'pointer', color, 
                    padding: '2px', display: 'flex', borderRadius: '50%',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `${color}20`}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <X size={12} strokeWidth={3} />
                </button>
              )}
            </motion.span>
          );
        })}
        {!readOnly && tags.length < maxTags && (
          <input
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
            onKeyDown={handleKey}
            onFocus={() => { setFocused(true); setShowSuggestions(true); }}
            onBlur={() => { 
              setFocused(false); 
              setTimeout(() => setShowSuggestions(false), 200);
              if (input.trim() && !showSuggestions) addTag(input); 
            }}
            placeholder={tags.length === 0 ? placeholder : ''}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              fontSize: '0.875rem', color: 'var(--color-text)',
              width: input ? `${Math.max(100, input.length * 10)}px` : '120px',
              minWidth: 80, padding: '4px 0',
            }}
          />
        )}
      </div>

      <AnimatePresence>
        {showSuggestions && filteredSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              marginTop: '0.5rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)',
              maxHeight: '200px', overflowY: 'auto', padding: '0.5rem'
            }}
          >
            {filteredSuggestions.map(s => (
              <div
                key={s}
                onClick={() => addTag(s)}
                style={{
                  padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                }}
                className="hover-bg"
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: getTagColor(s) }} />
                {s}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const TagDisplay: React.FC<{ tags: string[]; max?: number }> = ({ tags, max = 3 }) => {
  const visible = tags.slice(0, max);
  const more = tags.length - max;
  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '0.375rem', alignItems: 'center' }}>
      {visible.map(tag => {
        const color = getTagColor(tag);
        return (
          <span key={tag} style={{
            padding: '2px 10px', borderRadius: 'var(--radius-full)',
            background: `${color}12`, color, border: `1px solid ${color}20`,
            fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            {tag}
          </span>
        );
      })}
      {more > 0 && (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, background: 'var(--color-bg)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>+{more}</span>
      )}
    </div>
  );
};
