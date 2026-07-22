import React, { useState, useEffect, useRef } from 'react';
import { Upload, Image as ImageIcon, Link2, FileText, X, Check, Eye, Paperclip, Clipboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PendingUploadItem {
  file?: File;
  url?: string;
  previewUrl: string;
  name: string;
  size?: string;
  isImage: boolean;
  label: string;
}

interface PasteDropzoneAreaProps {
  onConfirmUpload: (item: { file?: File; url?: string; label: string }) => Promise<void>;
  placeholder?: string;
  subtext?: string;
  compact?: boolean;
  accept?: string;
  disabled?: boolean;
}

export const PasteDropzoneArea: React.FC<PasteDropzoneAreaProps> = ({
  onConfirmUpload,
  placeholder = 'Kéo thả tệp tin hoặc dán ảnh chụp màn hình (Ctrl+V)',
  subtext = 'Hỗ trợ dán ảnh trực tiếp từ Clipboard hoặc nhập đường dẫn link',
  compact = false,
  accept = '*',
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingItem, setPendingItem] = useState<PendingUploadItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Global & Local Paste Listener for Ctrl+V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || pendingItem || uploading) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // 1. Paste Image from Clipboard
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const previewUrl = URL.createObjectURL(file);
            const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
            const defaultName = `Screenshot_${new Date().toISOString().substring(0, 10)}_${Math.floor(Math.random() * 1000)}.png`;
            setPendingItem({
              file,
              previewUrl,
              name: defaultName,
              size: sizeStr,
              isImage: true,
              label: defaultName.replace(/\.[^/.]+$/, "")
            });
            return;
          }
        }
        
        // 2. Paste URL from Clipboard if it looks like a link
        if (item.type === 'text/plain') {
          item.getAsString((text) => {
            const trimmed = text.trim();
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
              setPendingItem({
                url: trimmed,
                previewUrl: '',
                name: trimmed,
                isImage: false,
                label: 'Liên kết đính kèm'
              });
            }
          });
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, pendingItem, uploading]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || e.dataTransfer.files.length === 0) return;

    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const processFile = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : '';
    const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    setPendingItem({
      file,
      previewUrl,
      name: file.name,
      size: sizeStr,
      isImage,
      label: file.name.replace(/\.[^/.]+$/, "")
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
      e.target.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!pendingItem || uploading) return;
    setUploading(true);
    try {
      await onConfirmUpload({
        file: pendingItem.file,
        url: pendingItem.url,
        label: pendingItem.label.trim() || pendingItem.name
      });
      setPendingItem(null);
    } catch (err) {
      console.error('Upload preview confirm error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Dropzone Box */}
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        style={{
          border: isDragOver ? '2px dashed #BD1D2D' : '2px dashed var(--color-border)',
          borderRadius: '12px',
          padding: compact ? '1rem' : '1.5rem 1rem',
          textAlign: 'center',
          background: isDragOver ? 'rgba(189, 29, 45, 0.04)' : 'var(--color-bg)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
        className="hover-border-primary"
      >
        <input
          type="file"
          ref={fileInputRef}
          accept={accept}
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          disabled={disabled}
        />

        <div style={{
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          borderRadius: '50%',
          background: isDragOver ? '#BD1D2D' : 'var(--color-surface)',
          color: isDragOver ? '#ffffff' : '#BD1D2D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-xs)',
          transition: 'all 0.2s ease'
        }}>
          <Upload size={compact ? 18 : 22} />
        </div>

        <div>
          <p style={{ margin: 0, fontSize: compact ? '0.8125rem' : '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {placeholder}
          </p>
          {subtext && (
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {subtext}
            </p>
          )}
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '6px',
          background: 'rgba(189, 29, 45, 0.08)',
          color: '#BD1D2D',
          fontSize: '0.7rem',
          fontWeight: 700,
          marginTop: '2px'
        }}>
          <Clipboard size={12} />
          <span>Nhấn Ctrl+V để dán ngay từ máy tính</span>
        </div>
      </div>

      {/* PREVIEW MODAL BEFORE CONFIRMING UPLOAD ("Có preview trước khi up thật nha") */}
      <AnimatePresence>
        {pendingItem && (
          <div className="overlay-backdrop" style={{ zIndex: 1000030, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => !uploading && setPendingItem(null)}>
            <motion.div
              style={{
                width: '100%',
                maxWidth: '480px',
                background: 'var(--color-surface, #ffffff)',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
                border: '1px solid var(--color-border)'
              }}
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--color-border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} style={{ color: '#BD1D2D' }} />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    Xem trước đính kèm (Preview)
                  </h4>
                </div>
                <button
                  disabled={uploading}
                  onClick={() => setPendingItem(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body: Image or File Preview */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingItem.isImage && pendingItem.previewUrl ? (
                  <div style={{
                    maxHeight: '260px',
                    width: '100%',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#0a0a0a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--color-border)'
                  }}>
                    <img
                      src={pendingItem.previewUrl}
                      alt="Preview"
                      style={{ maxHeight: '260px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div style={{
                    padding: '1.5rem',
                    borderRadius: '12px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '10px',
                      background: 'rgba(189, 29, 45, 0.1)',
                      color: '#BD1D2D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {pendingItem.url ? <Link2 size={24} /> : <FileText size={24} />}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pendingItem.name}
                      </div>
                      {pendingItem.size && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          Dung lượng: {pendingItem.size}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit Title/Label Input */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    Tên hiển thị đính kèm
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={pendingItem.label}
                    onChange={e => setPendingItem({ ...pendingItem, label: e.target.value })}
                    placeholder="Nhập tên đính kèm..."
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div style={{
                padding: '1rem 1.25rem',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                background: 'var(--color-bg)'
              }}>
                <button
                  type="button"
                  className="btn outline sm"
                  disabled={uploading}
                  onClick={() => setPendingItem(null)}
                  style={{ borderRadius: '20px', padding: '6px 18px' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn primary sm"
                  disabled={uploading}
                  onClick={handleConfirm}
                  style={{
                    backgroundColor: '#BD1D2D',
                    color: '#ffffff',
                    borderRadius: '20px',
                    padding: '6px 20px',
                    fontWeight: 600,
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Check size={16} />
                  <span>{uploading ? 'Đang tải lên...' : 'Xác nhận Tải lên'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
