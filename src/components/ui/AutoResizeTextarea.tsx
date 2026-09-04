import React, { useRef, useLayoutEffect, useEffect } from 'react';

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
  maxRows?: number;
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value,
  minRows = 1,
  maxRows = 5,
  onChange,
  onInput,
  onFocus,
  style,
  className = 'form-input sm',
  rows,
  ...rest
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;

    // Save previous scroll position so it doesn't jump when content > maxRows
    const prevScrollTop = el.scrollTop;

    // Reset height to auto to compute natural scrollHeight
    el.style.height = 'auto';

    const computed = window.getComputedStyle(el);
    let lineHeight = parseFloat(computed.lineHeight);
    if (isNaN(lineHeight) || lineHeight <= 0) {
      const fontSize = parseFloat(computed.fontSize) || 12.5;
      lineHeight = fontSize * 1.35;
    }

    const paddingTop = parseFloat(computed.paddingTop) || 4;
    const paddingBottom = parseFloat(computed.paddingBottom) || 4;
    const borderTop = parseFloat(computed.borderTopWidth) || 1;
    const borderBottom = parseFloat(computed.borderBottomWidth) || 1;

    const verticalPaddingAndBorder = paddingTop + paddingBottom + borderTop + borderBottom;
    const effectiveMinRows = rows ?? minRows;
    const minH = effectiveMinRows * lineHeight + verticalPaddingAndBorder;
    const maxH = maxRows * lineHeight + verticalPaddingAndBorder;

    // Outer height needed for content (scrollHeight + borders)
    const contentH = el.scrollHeight + borderTop + borderBottom;
    const targetHeight = Math.min(Math.max(contentH, minH), maxH);

    el.style.height = `${Math.ceil(targetHeight)}px`;
    el.style.overflowY = contentH > maxH ? 'auto' : 'hidden';
    
    // Restore scroll position
    if (prevScrollTop > 0) {
      el.scrollTop = prevScrollTop;
    }
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value, minRows, maxRows, rows]);

  // Adjust on width resize (e.g. drawer resize or responsive breakpoint)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    let prevWidth = el.clientWidth;
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (el && el.clientWidth !== prevWidth) {
            prevWidth = el.clientWidth;
            adjustHeight();
          }
        })
      : null;

    if (ro) ro.observe(el);

    const handleWindowResize = () => adjustHeight();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight();
    if (onChange) onChange(e);
  };

  const handleTextareaInput = (e: any) => {
    adjustHeight();
    if (onInput) onInput(e);
  };

  const handleTextareaFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    adjustHeight();
    if (onFocus) onFocus(e);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value ?? ''}
      onChange={handleTextareaChange}
      onInput={handleTextareaInput}
      onFocus={handleTextareaFocus}
      rows={rows ?? minRows}
      className={className}
      style={{
        boxSizing: 'border-box',
        resize: 'none',
        lineHeight: 1.35,
        transition: 'height 0.1s ease',
        ...style,
      }}
      {...rest}
    />
  );
};

export default AutoResizeTextarea;

